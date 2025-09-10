import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const s3 = new S3Client({ region: process.env.AWS_REGION! });

function contentDisposition(filename: string) {
    // Use ASCII-only for filename= to satisfy ByteString limits
    // Keep full UTF-8 in filename*= per RFC 5987
    const asciiSafe = filename
        .normalize('NFC')
        .replace(/["\\]/g, match => (match === '"' ? '\\"' : '\\\\'))
        .replace(/[^\x20-\x7E]/g, '_');
    const utf8Encoded = encodeURIComponent(filename);
    return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${utf8Encoded}`;
}

// GET /api/boxes/:box/files/:file - Stream file download and delete after transfer
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ box: string; file: string }> }
) {
    const { box, file } = await params;
    const bucket = process.env.AWS_BUCKET_NAME!;
    const key = `box${box}/${file}`;

    console.log(`[API] Starting download for box ${box}, file: ${file}`);

    try {
        const s3Response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        
        if (!s3Response.Body || typeof s3Response.Body.transformToWebStream !== 'function') {
            console.error(`[API] File not found: ${key}`);
            return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
        }

        console.log(`[API] File found, starting stream for: ${key}`);

        // Manual ReadableStream to detect full consumption and run side effects
        const src = s3Response.Body.transformToWebStream();
        const reader = src.getReader();

        const stream = new ReadableStream({
            async pull(controller) {
                const { value, done } = await reader.read();
                if (done) {
                    try {
                        // Client fully consumed the stream → now do side effects
                        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
                        await pusherServer.trigger('garden', 'file-deleted', {
                            boxNumber: box,
                            fileName: file
                        });
                    } catch (err) {
                        console.error('[API] post-stream cleanup failed', err);
                    } finally {
                        controller.close();
                    }
                    return;
                }
                controller.enqueue(value);
            },
            async cancel(reason) {
                try {
                    // Client aborted → don't delete (user can retry)
                    console.warn('[API] client aborted stream', reason);
                } finally {
                    try { await reader.cancel(); } catch {}
                }
            }
        });

        const headers = new Headers();
        // Force download behavior across browsers (avoid inline preview)
        headers.set("Content-Type", "application/octet-stream");
        headers.set("Content-Disposition", contentDisposition(file));
        // Security and caching hygiene
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Cache-Control", "no-store");
        headers.set("Accept-Ranges", "bytes");

        console.log(`[API] Returning stream response for box ${box}`);
        return new Response(stream, { headers });

    } catch (err) {
        console.error(`[API] Download error for ${key}:`, err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
}

// DELETE /api/boxes/:box/files/:file - Delete a specific file
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ box: string; file: string }> }
) {
    const { box, file } = await params;
    const bucket = process.env.AWS_BUCKET_NAME!;

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
