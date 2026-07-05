import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  ...(process.env.S3_ENDPOINT
    ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
    : {}),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.S3_BUCKET ?? "worldstar-uploads";

export const ALLOWED_VIDEO_TYPES = new Map<string, string>([
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
]);

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export interface PresignedUpload {
  uploadUrl: string;
  sourceKey: string;
  expiresInSeconds: number;
}

/**
 * Presigned PUT so the browser uploads straight to object storage —
 * the raw bytes never touch our servers.
 */
export async function createPresignedUpload(
  userId: string,
  contentType: string,
  contentLength: number,
): Promise<PresignedUpload> {
  const ext = ALLOWED_VIDEO_TYPES.get(contentType);
  if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
  if (contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`);
  }

  const sourceKey = `raw/${userId}/${nanoid(21)}.${ext}`;
  const expiresInSeconds = 900; // 15 min to start the upload

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: sourceKey,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: expiresInSeconds },
  );

  return { uploadUrl, sourceKey, expiresInSeconds };
}

export function cdnUrl(key: string): string {
  const base = (process.env.CDN_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/${key}`;
}
