import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const s3 = new S3Client({ region: process.env.AWS_REGION });

const HEALTH_PREFIX = "device-health/";
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// POST /api/devices/health — receive heartbeat from a device
export async function POST(request: NextRequest) {
  const bucket = process.env.AWS_BUCKET_NAME;
  if (!bucket) {
    return NextResponse.json(
      { error: "AWS bucket configuration missing" },
      { status: 500 }
    );
  }

  try {
    const { deviceId, connected, timestamp } = await request.json();

    if (!deviceId || typeof connected !== "boolean" || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: deviceId, connected, timestamp" },
        { status: 400 }
      );
    }

    const key = `${HEALTH_PREFIX}${deviceId}.json`;
    const body = JSON.stringify({ deviceId, connected, timestamp });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
      })
    );

    console.log(`[API] Device health stored for ${deviceId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API] Device health POST error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET /api/devices/health — fetch all device health statuses
export async function GET() {
  const bucket = process.env.AWS_BUCKET_NAME;
  if (!bucket) {
    return NextResponse.json(
      { error: "AWS bucket configuration missing" },
      { status: 500 }
    );
  }

  try {
    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: HEALTH_PREFIX,
      })
    );

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return NextResponse.json([]);
    }

    const now = Date.now();
    const devices = await Promise.all(
      listResult.Contents.filter(
        (obj) => obj.Key && !obj.Key.endsWith("/") && (obj.Size || 0) > 0
      ).map(async (obj) => {
        const result = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: obj.Key })
        );
        const body = await result.Body?.transformToString();
        const data = JSON.parse(body || "{}");
        const lastSeen = new Date(data.timestamp).getTime();
        return {
          ...data,
          stale: now - lastSeen > STALE_THRESHOLD_MS,
        };
      })
    );

    return NextResponse.json(devices);
  } catch (err) {
    console.error("[API] Device health GET error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
