import {
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME || "brian-media";

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required",
  );
}

const r2 = new S3Client({
  region: "auto",
  endpoint: endpoint.replace(/\/$/, ""),
  credentials: { accessKeyId, secretAccessKey },
});

export async function uploadMedia(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentLength: body.length,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error &&
      typeof error.$metadata === "object" &&
      error.$metadata !== null &&
      "httpStatusCode" in error.$metadata
        ? String(error.$metadata.httpStatusCode)
        : "unknown";
    throw new Error(
      `R2 upload failed for bucket '${bucket}' with HTTP status ${code}. ` +
        "Check that the R2 S3 token has Object Read & Write access to this bucket.",
      { cause: error },
    );
  }
}

export async function mediaUrl(key: string): Promise<string> {
  const baseUrl = process.env.BACKEND_PUBLIC_URL;
  if (!baseUrl) {
    throw new Error("BACKEND_PUBLIC_URL is required to return media URLs");
  }
  return `${baseUrl.replace(/\/$/, "")}/api/media?key=${encodeURIComponent(key)}`;
}

export async function signedMediaUrl(key: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 300 },
  );
}

export async function deleteMediaObjects(keys: string[]): Promise<void> {
  const uniqueKeys = [...new Set(keys)].filter(Boolean);
  if (uniqueKeys.length === 0) {
    return;
  }
  await r2.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: uniqueKeys.map((Key) => ({ Key })) },
    }),
  );
}

export async function listMediaObjects(): Promise<
  Array<{ key: string; size: number; lastModified: Date | null }>
> {
  const objects: Array<{
    key: string;
    size: number;
    lastModified: Date | null;
  }> = [];
  let continuationToken: string | undefined;

  do {
    const result = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of result.Contents ?? []) {
      if (object.Key) {
        objects.push({
          key: object.Key,
          size: object.Size ?? 0,
          lastModified: object.LastModified ?? null,
        });
      }
    }
    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects.sort((a, b) => {
    const left = a.lastModified?.getTime() ?? 0;
    const right = b.lastModified?.getTime() ?? 0;
    return right - left;
  });
}
