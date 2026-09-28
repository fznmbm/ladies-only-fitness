import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectVersionsCommand,
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
  await putFile(key, bytes, file.type);
  return key;
}

/** Stores a photo of a cost's receipt (hall hire and so on). */
export async function uploadExpenseReceipt(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `expenses/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await putFile(key, bytes, file.type);
  return key;
}

async function putFile(key: string, bytes: Uint8Array, type: string) {

  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: type || "application/octet-stream",
    }),
  );
}

/** A link to view one receipt that stops working after a few minutes. */
export async function receiptViewUrl(key: string): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: 300 },
  );
}

/** Permanently removes one receipt photo, including B2's older copies of it. */
export async function deleteReceipt(key: string): Promise<void> {
  const s3 = client();
  const Bucket = bucket();
  const page = await s3.send(
    new ListObjectVersionsCommand({ Bucket, Prefix: key }),
  );
  const copies = [...(page.Versions ?? []), ...(page.DeleteMarkers ?? [])];
  for (const c of copies) {
    if (c.Key !== key) continue; // Only this exact file.
    await s3.send(
      new DeleteObjectCommand({ Bucket, Key: key, VersionId: c.VersionId }),
    );
  }
}

/**
 * Permanently removes every receipt photo a lady ever uploaded, including any
 * left behind by a failed payment. B2 keeps old copies of files, so each copy
 * is removed by its version, otherwise the photo would only be hidden.
 */
export async function deleteMemberReceipts(memberId: string): Promise<number> {
  const s3 = client();
  const Bucket = bucket();
  const Prefix = `receipts/${memberId}/`;
  let removed = 0;
  let KeyMarker: string | undefined;
  let VersionIdMarker: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectVersionsCommand({
        Bucket,
        Prefix,
        KeyMarker,
        VersionIdMarker,
      }),
    );
    const copies = [...(page.Versions ?? []), ...(page.DeleteMarkers ?? [])];
    for (const c of copies) {
      if (!c.Key?.startsWith(Prefix)) continue; // Never touch anyone else's files.
      await s3.send(
        new DeleteObjectCommand({ Bucket, Key: c.Key, VersionId: c.VersionId }),
      );
      removed++;
    }
    KeyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
    VersionIdMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
  } while (KeyMarker);

  return removed;
}
