import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Normalises an uploaded logo to a 512x512 PNG (preserving aspect ratio,
 * transparent padding) before pushing it to R2, so the shell never has to
 * deal with arbitrarily large or oddly-shaped source images.
 */
export async function uploadLogo(organisationId: string, fileBuffer: Buffer): Promise<string> {
  const png = await sharp(fileBuffer)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const bucket = process.env.R2_BUCKET ?? "paracon-os";
  const key = `logos/${organisationId}.png`;

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: png, ContentType: "image/png" })
  );

  const publicUrl = process.env.R2_PUBLIC_URL ?? "";
  return `${publicUrl}/${key}?v=${Date.now()}`;
}
