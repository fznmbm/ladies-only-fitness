/**
 * Makes a receipt photo small enough to upload quickly, in the browser, before
 * it is sent. Phone photos are often 3-6 MB, which is slow on mobile data and
 * over the 4.5 MB the server accepts. A receipt stays perfectly readable at
 * 1600 pixels on its longest side, usually 200-500 KB.
 * If anything goes wrong, the original photo is used instead.
 */
const MAX_SIDE = 1600;
const SKIP_BELOW_BYTES = 800 * 1024; // Already small: leave it alone.

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < SKIP_BELOW_BYTES)
    return file;
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // Screenshots with see-through parts stay readable.
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "receipt.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
