import sharp from "sharp";

export async function autoRotateImage(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    return Buffer.from(buffer).toString("base64");
  }
  try {
    const rotated = await sharp(Buffer.from(buffer)).rotate().toBuffer();
    return rotated.toString("base64");
  } catch {
    return Buffer.from(buffer).toString("base64");
  }
}
