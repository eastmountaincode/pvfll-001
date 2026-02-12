import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const s3 = new S3Client({ region: process.env.AWS_REGION });
const HEALTH_PREFIX = "device-health/";
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

interface DeviceHealth {
  deviceId: string;
  connected: boolean;
  timestamp: string;
  stale: boolean;
}

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function getDeviceHealth(): Promise<DeviceHealth[]> {
  const bucket = process.env.AWS_BUCKET_NAME;
  if (!bucket) return [];

  try {
    const listResult = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: HEALTH_PREFIX })
    );

    if (!listResult.Contents || listResult.Contents.length === 0) return [];

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
          deviceId: data.deviceId,
          connected: data.connected,
          timestamp: data.timestamp,
          stale: now - lastSeen > STALE_THRESHOLD_MS,
        };
      })
    );

    return devices;
  } catch (err) {
    console.error("[Admin] Failed to fetch device health:", err);
    return [];
  }
}

function StatusDot({ connected, stale }: { connected: boolean; stale: boolean }) {
  if (stale) {
    return (
      <span
        className="inline-block w-3 h-3 rounded-full bg-yellow-400"
        title="Stale"
      />
    );
  }
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full ${
        connected ? "bg-green-500" : "bg-red-500"
      }`}
      title={connected ? "Connected" : "Disconnected"}
    />
  );
}

export default async function AdminPage() {
  const devices = await getDeviceHealth();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Device Status</h1>

        {devices.length === 0 ? (
          <p className="text-gray-500">No devices have reported in yet.</p>
        ) : (
          <table className="w-full border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-100 text-left text-sm text-gray-600">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Connection</th>
                <th className="px-4 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.deviceId} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <StatusDot
                      connected={device.connected}
                      stale={device.stale}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {device.deviceId}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {device.stale
                      ? "Stale"
                      : device.connected
                        ? "Connected"
                        : "Disconnected"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {relativeTime(device.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
