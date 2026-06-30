import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenant";
import { buildAuthUrl, exchangeCodeForTokens, getDriveClient, mintAccessToken } from "./client";

export type GoogleDriveConnectionView = {
  connected: boolean;
  googleAccountEmail: string | null;
  enabled: boolean;
  lastTestedAt: Date | null;
};

const ROOT_FOLDER_NAME = "OneParacon Documents";

function toView(row: { googleAccountEmail: string; enabled: boolean; lastTestedAt: Date | null } | null): GoogleDriveConnectionView {
  if (!row) return { connected: false, googleAccountEmail: null, enabled: false, lastTestedAt: null };
  return { connected: true, googleAccountEmail: row.googleAccountEmail, enabled: row.enabled, lastTestedAt: row.lastTestedAt };
}

export async function getConnectionView(organisationId: string): Promise<GoogleDriveConnectionView> {
  const row = await prisma.googleDriveConnection.findUnique({ where: { organisationId } });
  return toView(row);
}

/** Step 1 of the connect flow — redirects the admin to Google's consent screen. `state` carries the org id through the round trip. */
export function startConnect(organisationId: string): string {
  return buildAuthUrl(organisationId);
}

/**
 * Step 2 — exchanges the callback `code` for a refresh token, creates the
 * org's root "OneParacon Documents" folder in the connected account's Drive
 * (idempotent — reuses it if a prior connect already created one with the
 * same name), and stores the connection.
 */
export async function completeConnect(organisationId: string, userId: string, code: string): Promise<GoogleDriveConnectionView> {
  const { refreshToken, email } = await exchangeCodeForTokens(code);
  const accessToken = await mintAccessToken(refreshToken);
  const rootFolderId = await findOrCreateFolder(accessToken, ROOT_FOLDER_NAME, null);

  const row = await prisma.googleDriveConnection.upsert({
    where: { organisationId },
    create: {
      organisationId,
      googleAccountEmail: email,
      refreshTokenEncrypted: encrypt(refreshToken),
      rootFolderId,
      enabled: true,
      connectedByUserId: userId,
      lastTestedAt: new Date(),
    },
    update: {
      googleAccountEmail: email,
      refreshTokenEncrypted: encrypt(refreshToken),
      rootFolderId,
      enabled: true,
      connectedByUserId: userId,
      lastTestedAt: new Date(),
    },
  });

  return toView(row);
}

export async function disconnect(organisationId: string): Promise<void> {
  const existing = await prisma.googleDriveConnection.findUnique({ where: { organisationId } });
  if (!existing) throw new NotFoundError("Google Drive is not connected");
  await prisma.googleDriveConnection.delete({ where: { organisationId } });
}

/** Mints a fresh access token and calls Drive's lightweight `about` endpoint to confirm the grant still works. */
export async function testConnection(organisationId: string): Promise<void> {
  const connection = await requireConnection(organisationId);
  const accessToken = await mintAccessToken(decrypt(connection.refreshTokenEncrypted));
  const drive = getDriveClient(accessToken);
  await drive.about.get({ fields: "user(emailAddress)" });
  await prisma.googleDriveConnection.update({ where: { organisationId }, data: { lastTestedAt: new Date() } });
}

async function requireConnection(organisationId: string) {
  const connection = await prisma.googleDriveConnection.findUnique({ where: { organisationId } });
  if (!connection || !connection.enabled) throw new BadRequestError("Google Drive is not connected for this organisation");
  return connection;
}

/** Mints a short-lived access token for this org's connection — used server-side for uploads, or handed to the browser for the Picker widget (drive.file scope only, so Picker can never browse outside what OneParacon itself created/picked). */
export async function mintOrgAccessToken(organisationId: string): Promise<string> {
  const connection = await requireConnection(organisationId);
  return mintAccessToken(decrypt(connection.refreshTokenEncrypted));
}

async function findOrCreateFolder(accessToken: string, name: string, parentId: string | null): Promise<string> {
  const drive = getDriveClient(accessToken);
  const parentClause = parentId ? `'${parentId}' in parents and ` : "";
  const escapedName = name.replace(/'/g, "\\'");

  const existing = await drive.files.list({
    q: `${parentClause}name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    spaces: "drive",
  });
  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!created.data.id) throw new BadRequestError("Failed to create the Drive folder");
  return created.data.id;
}

type FolderTarget = { projectId?: string | null; tenderId?: string | null };

/**
 * Lazily creates (and caches on Project.driveFolderId / Tender.driveFolderId)
 * a Drive folder for one project or tender, nested under the org's root
 * folder — every folder OneParacon touches lives inside a tree it created
 * itself, never loose in the connected account's wider Drive.
 */
export async function ensureTargetFolder(db: TenantContext, organisationId: string, target: FolderTarget): Promise<string> {
  const connection = await requireConnection(organisationId);
  if (!connection.rootFolderId) throw new BadRequestError("Google Drive root folder is missing — reconnect Google Drive");

  if (target.projectId) {
    const project = await db.project.findFirst({ where: { id: target.projectId } });
    if (!project) throw new NotFoundError("Project not found");
    if (project.driveFolderId) return project.driveFolderId;

    const accessToken = await mintAccessToken(decrypt(connection.refreshTokenEncrypted));
    const folderId = await findOrCreateFolder(accessToken, project.name, connection.rootFolderId);
    await db.project.update({ where: { id: project.id }, data: { driveFolderId: folderId } });
    return folderId;
  }

  if (target.tenderId) {
    const tender = await db.tender.findFirst({ where: { id: target.tenderId } });
    if (!tender) throw new NotFoundError("Tender not found");
    if (tender.driveFolderId) return tender.driveFolderId;

    const accessToken = await mintAccessToken(decrypt(connection.refreshTokenEncrypted));
    const folderId = await findOrCreateFolder(accessToken, tender.projectName, connection.rootFolderId);
    await db.tender.update({ where: { id: tender.id }, data: { driveFolderId: folderId } });
    return folderId;
  }

  throw new BadRequestError("A target (project or tender) is required");
}

/**
 * Initiates a Drive resumable upload session server-side (the only step that
 * needs our access token) and hands the browser the resulting session URL —
 * the browser then PUTs the file bytes straight to Google, so a 500MB CAD
 * file is never proxied through our own server.
 */
export async function initiateUploadSession(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,thumbnailLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
      },
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    }
  );
  if (!res.ok) {
    throw new BadRequestError(`Google Drive declined the upload session: ${res.status} ${await res.text()}`);
  }
  const location = res.headers.get("Location");
  if (!location) throw new BadRequestError("Google Drive did not return an upload session URL");
  return location;
}
