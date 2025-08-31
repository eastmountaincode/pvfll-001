import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { NextRequest, NextResponse } from "next/server";

const s3 = new S3Client({ region: process.env.AWS_REGION})

export async function POST(request: NextRequest) {

    const maxFileSize = 1024 * 1024 * 100; // 100 MB

    try {
        const { boxNumber, fileName, fileType } = await request.json();

        if (!boxNumber || !fileName || !fileType) {
            return NextResponse.json({ error: "Missing required fields..." }, { status: 400 });
        }
        
        const key = `box${boxNumber}/${fileName}`;
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
        // expose the message during dev so you can see what's wrong
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
    
}