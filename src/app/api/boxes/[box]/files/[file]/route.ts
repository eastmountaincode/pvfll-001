import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

const s3 = new S3Client({ region: process.env.AWS_REGION });

// GET /api/boxes/:box/files/:file - Stream file download and delete after
export async function GET(
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
        // Get the file from S3
        const getCommand = new GetObjectCommand({ 
            Bucket: bucket, 
            Key: key
        });
        
        const s3Response = await s3.send(getCommand);
        
        if (!s3Response.Body) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Convert the stream to a buffer
        const chunks = [];
        const reader = s3Response.Body.transformToWebStream().getReader();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        
        const fileBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
            fileBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        // Delete the file from S3 after we have it
        await s3.send(new DeleteObjectCommand({ 
            Bucket: bucket, 
            Key: key 
        }));

        // Trigger Pusher event to notify all clients that the file was deleted
        await pusherServer.trigger('garden', 'file-deleted', {
            boxNumber: box,
            fileName: file
        });

        // Stream the file to the client
        return new Response(fileBuffer, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${file}"`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });

    } catch (err) {
        console.error("download/delete error:", err);
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
