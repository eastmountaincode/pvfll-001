import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

const s3 = new S3Client({ region: process.env.AWS_REGION });

// GET /api/boxes/:box/files/:file - Stream file download and delete after transfer
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ box: string; file: string }> }
) {
    const { box, file } = await params;
    const bucket = process.env.AWS_BUCKET_NAME;

    console.log(`[API] Starting download for box ${box}, file: ${file}`);
    console.log(`[API] File parameter: "${file}"`);
    console.log(`[API] Filename length: ${file.length}`);

    if (!bucket) {
        console.error(`[API] AWS bucket configuration missing`);
        return NextResponse.json({ error: "AWS bucket configuration missing" }, { status: 500 });
    }

    const key = `box${box}/${file}`;

    try {
        // Get the file from S3
        const getCommand = new GetObjectCommand({ 
            Bucket: bucket, 
            Key: key
        });
        
        // This returns metadata and a stream handle, but doesn't actually download yet
        const s3Response = await s3.send(getCommand);
        
        if (!s3Response.Body || typeof s3Response.Body.transformToWebStream !== 'function') {
            console.error(`[API] File not found: ${key}`);
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        console.log(`[API] File found, starting stream for: ${key}`);

        // Create a transform stream to handle cleanup after transfer
        const { readable, writable } = new TransformStream();
        
        // Start streaming from S3 to the transform stream
        const s3Stream = s3Response.Body.transformToWebStream();
        const pipePromise = s3Stream.pipeTo(writable);

        // Handle cleanup after the stream completes (successfully or not)
        pipePromise.finally(async () => {
            try {
                console.log(`[API] Stream completed, deleting file: ${key}`);
                
                // Delete the file from S3 after transfer
                await s3.send(new DeleteObjectCommand({ 
                    Bucket: bucket, 
                    Key: key 
                }));

                console.log(`[API] File deleted, sending Pusher event for box ${box}`);

                // Trigger Pusher event to notify all clients that the file was deleted
                await pusherServer.trigger('garden', 'file-deleted', {
                    boxNumber: box,
                    fileName: file
                });

                console.log(`[API] Cleanup completed for box ${box}`);
                
            } catch (cleanupError) {
                console.error(`[API] Cleanup failed for ${key}:`, cleanupError);
            }
        });

        // Set appropriate headers with proper filename encoding
        const headers = new Headers();
        headers.set('Content-Type', s3Response.ContentType || 'application/octet-stream');
        
        try {
            // Properly encode filename for Content-Disposition header
            // Use both filename and filename* (RFC 5987) for maximum compatibility
            const safeFilename = file.replace(/[^\x20-\x7E]/g, '_'); // ASCII-safe fallback
            const encodedFilename = encodeURIComponent(file);
            const dispositionValue = `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
            
            console.log(`[API] Setting Content-Disposition: ${dispositionValue}`);
            headers.set('Content-Disposition', dispositionValue);
        } catch (headerError) {
            console.error(`[API] Error setting Content-Disposition header:`, headerError);
            // Fallback to simple filename without special characters
            const fallbackFilename = file.replace(/[^\w\s.-]/g, '_');
            headers.set('Content-Disposition', `attachment; filename="${fallbackFilename}"`);
        }
        
        if (typeof s3Response.ContentLength === 'number') {
            headers.set('Content-Length', String(s3Response.ContentLength));
        }

        console.log(`[API] Returning stream response for box ${box}`);

        // Return the readable stream to the client
        return new Response(readable, { headers });

    } catch (err) {
        console.error(`[API] Download error for ${key}:`, err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// DELETE /api/boxes/:box/files/:file - Delete a specific file
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ box: string; file: string }> }
) {
    const { box, file } = await params;
    const bucket = process.env.AWS_BUCKET_NAME;

    if (!bucket) {
        return NextResponse.json({ error: "AWS bucket configuration missing" }, { status: 500 });
    }

    const key = `box${box}/${file}`;

    try {
        await s3.send(new DeleteObjectCommand({ 
            Bucket: bucket, 
            Key: key 
        }));

        // Trigger Pusher event to notify all clients that the file was deleted
        await pusherServer.trigger('garden', 'file-deleted', {
            boxNumber: box,
            fileName: file
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("delete file error:", err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
