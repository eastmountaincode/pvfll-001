import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const s3 = new S3Client({ region: process.env.AWS_REGION! });

function contentDisposition(filename: string) {
    const safe = filename.replace(/"/g, '\\"');
    return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string) {
    return Promise.race([
        p,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms)),
    ]);
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

        const { readable, writable } = new TransformStream();
        const pipePromise = s3Response.Body.transformToWebStream().pipeTo(writable);

        // Post-response cleanup using setTimeout to defer until after response is sent
        setTimeout(async () => {
            try {
                console.log(`[API] Waiting for stream completion for: ${key}`);
                // Only proceed on full, successful client read
                await pipePromise;
                
                console.log(`[API] Stream completed, deleting file: ${key}`);
                await withTimeout(s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })), 8000, "S3 Delete");
                
                console.log(`[API] File deleted, sending Pusher event for box ${box}`);
                await withTimeout(
                    pusherServer.trigger("garden", "file-deleted", { boxNumber: box, fileName: file }),
                    8000,
                    "Pusher trigger"
                );
                
                console.log(`[API] Cleanup completed for box ${box}`);
            } catch (err) {
                // Catches stream aborts OR delete/notify failures
                console.error(`[API] Post-response cleanup error for ${key}:`, err);
            }
        }, 0); // Execute on next tick, after response is sent

        const headers = new Headers();
        headers.set("Content-Type", s3Response.ContentType || "application/octet-stream");
        headers.set("Content-Disposition", contentDisposition(file));
        if (typeof s3Response.ContentLength === "number") headers.set("Content-Length", String(s3Response.ContentLength));
        headers.set("Cache-Control", "no-store");

        console.log(`[API] Returning stream response for box ${box}`);
        return new Response(readable, { headers });

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
