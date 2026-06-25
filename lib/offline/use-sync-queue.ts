"use client";

import { useCallback, useEffect, useState } from "react";
import { listMutations, type QueueMutation } from "./db";
import { flushQueue, subscribe } from "./sync-queue";

const POLL_INTERVAL_MS = 20_000;

export function useSyncQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [failed, setFailed] = useState<QueueMutation[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  const refresh = useCallback(async () => {
    const mutations = await listMutations();
    setPendingCount(mutations.filter((m) => m.status === "pending").length);
    setFailed(mutations.filter((m) => m.status === "error"));
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refresh();
    const unsubscribe = subscribe(refresh);

    const handleOnline = () => {
      setIsOnline(true);
      void flushQueue().then(refresh);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void flushQueue().then(refresh);
    const interval = setInterval(() => {
      if (navigator.onLine) void flushQueue().then(refresh);
    }, POLL_INTERVAL_MS);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refresh]);

  return { pendingCount, failed, isOnline };
}
