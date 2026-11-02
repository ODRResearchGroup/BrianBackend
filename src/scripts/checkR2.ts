import "dotenv/config";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME || "brian-media";

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required",
  );
}

const client = new S3Client({
  region: "auto",
  endpoint: endpoint.replace(/\/$/, ""),
  credentials: { accessKeyId, secretAccessKey },
});

async function main(): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`R2 bucket access is valid for '${bucket}'.`);
  } catch (error) {
    console.error(
      `R2 bucket access failed for '${bucket}'. The token must have Object Read & Write access to this bucket.`,
    );
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
