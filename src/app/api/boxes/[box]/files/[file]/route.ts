import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

const s3 = new S3Client({ region: process.env.AWS_REGION });

// GET /api/boxes/:box/files/:file - Get download URL for a specific file
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
        const command = new GetObjectCommand({ 
            Bucket: bucket, 
            Key: key,
            ResponseContentDisposition: `attachment; filename="${file}"`
        });
        
        const url = await getSignedUrl(s3, command, { expiresIn: 120 }); // 2 minutes

        return NextResponse.json({ url });
    } catch (err: any) {
        console.error("download url error:", err);
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
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

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("delete file error:", err);
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
}
