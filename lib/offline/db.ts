import { openDB, type IDBPDatabase } from "idb";
import type { DailyUpdateSubmitInput } from "@/lib/validations/site-update";

export type PhotoMutationPayload = {
  projectId: string;
  date: string;
  caption: string | null;
  tag: string;
  fileName: string;
  blob: Blob;
};

export type IssueMutationPayload = {
  projectId: string;
  date: string;
  description: string;
  severity: string;
  photoTempIds: string[];
};

export type QueueMutation =
  | { id: string; kind: "photo"; createdAt: number; status: "pending" | "error"; error?: string; payload: PhotoMutationPayload }
  | { id: string; kind: "issue"; createdAt: number; status: "pending" | "error"; error?: string; payload: IssueMutationPayload }
  | { id: string; kind: "submit"; createdAt: number; status: "pending" | "error"; error?: string; payload: DailyUpdateSubmitInput };

const DB_NAME = "oneparacon-site-queue";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("mutations")) db.createObjectStore("mutations", { keyPath: "id" });
        if (!db.objectStoreNames.contains("tempIdMap")) db.createObjectStore("tempIdMap", { keyPath: "tempId" });
      },
    });
  }
  return dbPromise;
}

export async function putMutation(mutation: QueueMutation): Promise<void> {
  const db = await getDb();
  await db.put("mutations", mutation);
}

/** Oldest-first — the sync queue is strictly ordered so a photo always resolves before the issue that references it. */
export async function listMutations(): Promise<QueueMutation[]> {
  const db = await getDb();
  const all = (await db.getAll("mutations")) as QueueMutation[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteMutation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("mutations", id);
}

export async function updateMutationStatus(id: string, status: "pending" | "error", error?: string): Promise<void> {
  const db = await getDb();
  const existing = (await db.get("mutations", id)) as QueueMutation | undefined;
  if (!existing) return;
  await db.put("mutations", { ...existing, status, error });
}

export async function setResolvedStoredFileId(tempId: string, storedFileId: string): Promise<void> {
  const db = await getDb();
  await db.put("tempIdMap", { tempId, storedFileId });
}

export async function getResolvedStoredFileId(tempId: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await db.get("tempIdMap", tempId);
  return row?.storedFileId;
}
