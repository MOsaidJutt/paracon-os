"use client";

import {
  deleteMutation,
  getResolvedStoredFileId,
  listMutations,
  putMutation,
  setResolvedStoredFileId,
  updateMutationStatus,
  type IssueMutationPayload,
  type PhotoMutationPayload,
  type QueueMutation,
} from "./db";
import type { DailyUpdateSubmitInput } from "@/lib/validations/site-update";

const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function safeErrorText(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

let flushing = false;
let rerunRequested = false;

/**
 * Flushes the queue in strict creation order. A 4xx response means the
 * mutation itself is invalid — mark it as a visible error and move on so one
 * bad item never blocks everything behind it. Any other failure (network
 * error, 5xx) stops the whole pass — those are retryable, so leave the
 * mutation (and everything after it) queued for the next attempt.
 *
 * If something enqueues a new mutation while a pass is already running, that
 * call just sets `rerunRequested` and returns — without this, a mutation
 * added mid-flush could sit unprocessed until the next 20s poll or the next
 * online event, since the in-flight pass already snapshotted its list.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) {
    rerunRequested = true;
    return;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  rerunRequested = false;
  try {
    const mutations = await listMutations();
    for (const mutation of mutations) {
      let outcome: "synced" | "failed-permanent" | "stop";
      try {
        outcome = await syncOne(mutation);
      } catch {
        outcome = "stop";
      }
      if (outcome === "stop") break;
      notifyListeners();
    }
  } finally {
    flushing = false;
    notifyListeners();
  }
  if (rerunRequested) {
    rerunRequested = false;
    await flushQueue();
  }
}

async function syncOne(mutation: QueueMutation): Promise<"synced" | "failed-permanent" | "stop"> {
  if (mutation.kind === "photo") {
    const form = new FormData();
    form.append("photo", mutation.payload.blob, mutation.payload.fileName);
    form.append("projectId", mutation.payload.projectId);
    form.append("date", mutation.payload.date);
    if (mutation.payload.caption) form.append("caption", mutation.payload.caption);
    form.append("tag", mutation.payload.tag);
    form.append("clientRef", mutation.id);

    const res = await fetch("/api/site/photos", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      await setResolvedStoredFileId(mutation.id, data.storedFile.id);
      await deleteMutation(mutation.id);
      return "synced";
    }
    if (res.status >= 400 && res.status < 500) {
      await updateMutationStatus(mutation.id, "error", await safeErrorText(res));
      return "failed-permanent";
    }
    return "stop";
  }

  if (mutation.kind === "issue") {
    const photoStoredFileIds: string[] = [];
    for (const tempId of mutation.payload.photoTempIds) {
      const resolved = await getResolvedStoredFileId(tempId);
      if (resolved) photoStoredFileIds.push(resolved);
    }
    const res = await fetch("/api/site/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...mutation.payload, photoStoredFileIds, clientRef: mutation.id }),
    });
    if (res.ok) {
      await deleteMutation(mutation.id);
      return "synced";
    }
    if (res.status >= 400 && res.status < 500) {
      await updateMutationStatus(mutation.id, "error", await safeErrorText(res));
      return "failed-permanent";
    }
    return "stop";
  }

  // kind === "submit"
  const res = await fetch("/api/site/daily-updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mutation.payload),
  });
  if (res.ok) {
    await deleteMutation(mutation.id);
    return "synced";
  }
  if (res.status >= 400 && res.status < 500) {
    await updateMutationStatus(mutation.id, "error", await safeErrorText(res));
    return "failed-permanent";
  }
  return "stop";
}

export async function enqueuePhoto(payload: PhotoMutationPayload): Promise<string> {
  const id = crypto.randomUUID();
  await putMutation({ id, kind: "photo", createdAt: Date.now(), status: "pending", payload });
  notifyListeners();
  void flushQueue();
  return id;
}

export async function enqueueIssue(payload: IssueMutationPayload): Promise<string> {
  const id = crypto.randomUUID();
  await putMutation({ id, kind: "issue", createdAt: Date.now(), status: "pending", payload });
  notifyListeners();
  void flushQueue();
  return id;
}

export async function enqueueSubmit(payload: DailyUpdateSubmitInput): Promise<string> {
  const id = crypto.randomUUID();
  await putMutation({ id, kind: "submit", createdAt: Date.now(), status: "pending", payload });
  notifyListeners();
  void flushQueue();
  return id;
}

export async function retryFailedMutation(id: string): Promise<void> {
  await updateMutationStatus(id, "pending", undefined);
  notifyListeners();
  void flushQueue();
}

export { listMutations };
