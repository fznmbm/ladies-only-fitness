import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Receipts live in a private Backblaze B2 bucket, never a public one.
 * The organiser views one through a link that expires in a few minutes,
 * generated fresh each time, rather than a permanent public URL.
 *
 * Get these from the B2 dashboard:
 * - B2_ENDPOINT: Bucket details > Endpoint, with https:// in front, e.g.
 *   https://s3.eu-central-003.backblazeb2.com
 * - B2_REGION: the part of the endpoint between "s3." and ".backblazeb2.com",
 *   e.g. eu-central-003
 * - B2_BUCKET: the bucket name
 * - B2_KEY_ID / B2_APPLICATION_KEY: an Application Key scoped to just this
 *   bucket, with read and write access
 */
function client(): S3Client {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const keyId = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  if (!endpoint || !region || !keyId || !appKey) {
    throw new Error(
      "Backblaze B2 isn't configured. Check B2_ENDPOINT, B2_REGION, B2_KEY_ID and B2_APPLICATION_KEY.",
    );
  }
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
  });
}

function bucket(): string {
  const b = process.env.B2_BUCKET;
  if (!b) throw new Error("B2_BUCKET isn't set.");
  return b;
}

/** Stores a receipt photo and returns the key to save on the subscription row. */
export async function uploadReceipt(
  file: File,
  memberId: string,
): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const key = `receipts/${memberId}/${Date.now()}.${ext}`;

  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: file.type || "application/octet-stream",
    }),
  );
  return key;
}

/** A link to view one receipt that stops working after a few minutes. */
export async function receiptViewUrl(key: string): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: 300 },
  );
}

export async function deleteReceipt(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
