"use client";

import { Badge } from "@/components/ui/badge";
import { useSyncQueue } from "@/lib/offline/use-sync-queue";

/** Plain-English sync state per the foreman-mobile rule: never "Network error", always "saved locally, will sync". */
export function SyncStatusBadge() {
  const { pendingCount, failed, isOnline } = useSyncQueue();

  if (!isOnline) {
    return <Badge variant="secondary">Offline — will sync</Badge>;
  }
  if (failed.length > 0) {
    return <Badge variant="destructive">{failed.length} need attention</Badge>;
  }
  if (pendingCount > 0) {
    return <Badge variant="secondary">Syncing…</Badge>;
  }
  return <Badge>Synced</Badge>;
}
