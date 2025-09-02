import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { NextRequest, NextResponse } from "next/server";

const s3 = new S3Client({ region: process.env.AWS_REGION});

// GET /api/boxes/:box/files - List files in a box
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ box: string }> }
) {
    const { box } = await params;
    const bucket = process.env.AWS_BUCKET_NAME;

    if (!bucket) {
        return NextResponse.json({ error: "AWS bucket configuration missing" }, { status: 500 });
    }

    const prefix = `box${box}/`;

    try {
        const data = await s3.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix
            })
        );

        if (!data.Contents || data.Contents.length === 0) {
            return NextResponse.json({ empty: true });
        }

        // Filter out folder markers - only get actual files
        const actualFiles = data.Contents.filter(obj => {
            const key = obj.Key || "";
            return !key.endsWith('/') && (obj.Size || 0) > 0;
        });

        if (actualFiles.length === 0) {
            return NextResponse.json({ empty: true });
        }

        const file = actualFiles[0];
        const fileName = file.Key?.replace(prefix, "") || "";

        return NextResponse.json({
            empty: false,
            name: fileName,
            size: file.Size || 0
        });
    } catch (err: any) {
        console.error("list files error:", err);
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
}

// POST /api/boxes/:box/files - Upload a file (presigned POST)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ box: string }> }
) {
    const { box } = await params;
    const maxFileSize = 1024 * 1024 * 100; // 100 MB

    try {
        const { fileName, fileType } = await request.json();

        if (!fileName || !fileType) {
            return NextResponse.json({ error: "Missing required fields..." }, { status: 400 });
        }
        
        const key = `box${box}/${fileName}`;
        const bucket = process.env.AWS_BUCKET_NAME;

        if (!bucket) {
            return NextResponse.json({ error: "AWS bucket configuration missing" }, { status: 500 });
        }

        const { url, fields } = await createPresignedPost(s3, {
            Bucket: bucket,
            Key: key,
            Expires: 120, // 2 minutes
            Fields: {
                "Content-Type": fileType,
            },
            Conditions: [
                ["content-length-range", 0, maxFileSize],
                ["starts-with", "$Content-Type", ""], // allow any content type
            ]
        })

        return NextResponse.json({ url, fields, key }, { status: 200 });
        
    } catch (err: any) {
        console.error("presign error:", err);
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
}
