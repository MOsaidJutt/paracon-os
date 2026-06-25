import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

/**
 * Generic S3-compatible client — endpoint/region/path-style are all
 * env-driven so the same code points at self-hosted MinIO (forcePathStyle
 * required) or Cloudflare R2 (forcePathStyle off) purely via config, per the
 * HYBRID storage requirement (own storage for almost everything; large CAD
 * stays in Google Drive as a LinkedDocument — see lib/documents).
 */
function getStorageClient(): S3Client {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage is not configured — set STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY"
    );
  }
  return new S3Client({
    region: process.env.STORAGE_REGION || "auto",
    endpoint,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  return process.env.STORAGE_BUCKET ?? "oneparacon";
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const client = getStorageClient();
  await client.send(new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
  const client = getStorageClient();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/** Fetches an object's full body into memory — only used for small, already-uploaded documents (preview generation). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const client = getStorageClient();
  const result = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Object "${key}" has no body`);
  return Buffer.from(bytes);
}

/** Public CDN-style URL — only used for assets we're happy to serve unauthenticated (org logos, worker photos). */
export function getPublicUrl(key: string): string {
  const publicUrl = process.env.STORAGE_PUBLIC_URL ?? "";
  return `${publicUrl}/${key}?v=${Date.now()}`;
}

/**
 * Short-lived signed GET URL for private objects (documents, compliance
 * files). Callers should mint a fresh one per request rather than caching it
 * — never store this URL itself, only the object key.
 */
export async function getSignedReadUrl(key: string, expiresInSeconds = 600): Promise<string> {
  const client = getStorageClient();
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Short-lived signed PUT URL so the browser uploads the file bytes directly
 * to storage (single PUT — real file sizes here top out ~10-15MB per the
 * source folder audit, so true chunked multipart isn't warranted). Our
 * server never sees the bytes; it only registers the resulting key.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 600
): Promise<string> {
  const client = getStorageClient();
  const command = new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Normalises an uploaded logo to a 512x512 PNG (preserving aspect ratio,
 * transparent padding) before pushing it to storage, so the shell never has
 * to deal with arbitrarily large or oddly-shaped source images.
 */
export async function uploadLogo(organisationId: string, fileBuffer: Buffer): Promise<string> {
  const png = await sharp(fileBuffer)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const key = `logos/${organisationId}.png`;
  await putObject(key, png, "image/png");
  return getPublicUrl(key);
}

/** Normalises a worker photo to a 512x512 cropped PNG, mirroring uploadLogo's treatment. */
export async function uploadWorkerPhoto(organisationId: string, workerId: string, fileBuffer: Buffer): Promise<string> {
  const png = await sharp(fileBuffer)
    .resize(512, 512, { fit: "cover" })
    .png()
    .toBuffer();

  const key = `workers/${organisationId}/${workerId}/photo.png`;
  await putObject(key, png, "image/png");
  return getPublicUrl(key);
}

/**
 * Site photos (foreman daily update / issue evidence) — re-compressed
 * server-side as a defence-in-depth backstop even though the mobile client
 * already compresses before queueing, so a future non-compressing caller
 * (e.g. a desktop upload) can never push an oversized original into storage.
 * Resized to fit within 1600px (no crop — these are evidence photos, not
 * avatars) and re-encoded as JPEG. Stored privately (signed URL on read,
 * like every other document) rather than publicly — site photos can contain
 * sensitive site/safety content, unlike a worker avatar or org logo.
 */
export async function uploadSitePhoto(
  organisationId: string,
  projectId: string,
  fileBuffer: Buffer,
  fileName: string
): Promise<{ key: string; size: number; mime: string }> {
  const jpeg = await sharp(fileBuffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();

  const key = `site-photos/${organisationId}/${projectId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}.jpg`;
  await putObject(key, jpeg, "image/jpeg");
  return { key, size: jpeg.byteLength, mime: "image/jpeg" };
}

/** Compliance docs (White Card photos, licenses, tickets) are stored as-is — no image normalisation. */
export async function uploadComplianceDoc(
  organisationId: string,
  workerId: string,
  complianceId: string,
  fileBuffer: Buffer,
  contentType: string,
  fileName: string
): Promise<string> {
  const key = `compliance/${organisationId}/${workerId}/${complianceId}/${fileName}`;
  await putObject(key, fileBuffer, contentType);
  return getPublicUrl(key);
}

/**
 * Best-effort JPEG preview for an image (incl. HEIC, where the underlying
 * libvips build supports it). Returns null rather than throwing on failure
 * so an upload never fails just because a thumbnail couldn't be made — the
 * UI falls back to a generic file-type icon + download link.
 */
export async function generateImagePreview(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .resize(900, 900, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
  } catch {
    return null;
  }
}

const PREVIEWABLE_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);

/**
 * Fetches an already-uploaded image (the client PUT it directly to storage,
 * so our server never saw the bytes), derives a JPEG thumbnail and stores it
 * alongside the original. Returns null — never throws — on any failure
 * (storage not configured, fetch failure, unsupported HEIC build) so a
 * document's registration never fails just because its thumbnail couldn't be
 * made; the UI falls back to a generic file-type icon.
 */
export async function generateAndStorePreview(key: string, mime: string, previewKey: string): Promise<string | null> {
  if (!PREVIEWABLE_IMAGE_MIME_TYPES.has(mime)) return null;
  try {
    const original = await getObjectBuffer(key);
    const preview = await generateImagePreview(original);
    if (!preview) return null;
    await putObject(previewKey, preview, "image/jpeg");
    return previewKey;
  } catch {
    return null;
  }
}
