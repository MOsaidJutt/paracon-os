import { inngest } from "@/lib/inngest/client";

/**
 * Fire-and-forget the named event. Every job-runner trigger is a best-effort
 * cache-warming signal, never the source of truth for the UI (the matrix/
 * compliance status are always computed synchronously too) — a misconfigured
 * or offline Inngest setup (no INNGEST_EVENT_KEY, no local `inngest-cli dev`)
 * must never fail the mutation that triggered it.
 */
export async function sendEvent(name: string): Promise<void> {
  try {
    await inngest.send({ name });
  } catch (error) {
    console.warn(`[inngest] failed to send "${name}":`, error instanceof Error ? error.message : error);
  }
}

/** Fire-and-forget with a typed data payload. Same resilience guarantee as sendEvent. */
export async function sendEventWithData<T extends Record<string, unknown>>(
  name: string,
  data: T
): Promise<void> {
  try {
    await inngest.send({ name, data });
  } catch (error) {
    console.warn(`[inngest] failed to send "${name}":`, error instanceof Error ? error.message : error);
  }
}
