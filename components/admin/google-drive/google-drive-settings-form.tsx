"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HardDrive } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type GoogleDriveConnection = {
  connected: boolean;
  googleAccountEmail: string | null;
  enabled: boolean;
  lastTestedAt: string | null;
  configured: boolean;
};

export function GoogleDriveSettingsForm() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "google-drive"],
    queryFn: async () => {
      const res = await fetch("/api/admin/google-drive");
      if (!res.ok) throw new Error("Failed to load Google Drive settings");
      return (await res.json()) as GoogleDriveConnection;
    },
  });

  // The OAuth callback redirects back here with ?connected=1 or ?error=... — surface it as a toast once, then clean the URL so a refresh doesn't re-fire it.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      toast.success("Google Drive connected");
      queryClient.invalidateQueries({ queryKey: ["admin", "google-drive"] });
    } else if (error) {
      toast.error(error);
    }
    if (connected || error) router.replace("/admin/google-drive");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/google-drive", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to disconnect");
      }
    },
    onSuccess: () => {
      toast.success("Google Drive disconnected");
      queryClient.invalidateQueries({ queryKey: ["admin", "google-drive"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/google-drive/test", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Connection failed");
      }
    },
    onSuccess: () => {
      toast.success("Connected successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "google-drive"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="size-4" />
          Google Drive (large CAD &amp; drawing sets)
        </CardTitle>
        <CardDescription>
          For files too large for our own storage (100–500MB CAD sets). Once connected, projects and tenders get an
          &quot;Upload to Drive&quot; and &quot;Browse Drive&quot; action on their Documents panel — files land in a
          OneParacon-owned folder tree in this Google account and open with one click, no folder-hunting. OneParacon
          can only see files and folders it creates or that a user explicitly picks, never the rest of the account&apos;s
          Drive.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!data?.configured && (
          <p className="rounded-md border border-rag-amber/40 bg-rag-amber/15 px-3 py-2 text-sm text-foreground">
            Not configured yet — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI and
            NEXT_PUBLIC_GOOGLE_API_KEY in the environment before connecting.
          </p>
        )}

        {data?.connected ? (
          <>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-foreground">{data.googleAccountEmail}</p>
                {data.lastTestedAt && (
                  <p className="text-xs text-muted-foreground">Last verified {new Date(data.lastTestedAt).toLocaleString("en-AU")}</p>
                )}
              </div>
              <Badge variant={data.enabled ? "secondary" : "outline"}>{data.enabled ? "Connected" : "Disabled"}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={testConnection.isPending} onClick={() => testConnection.mutate()}>
                {testConnection.isPending ? "Testing..." : "Test connection"}
              </Button>
              <Button size="sm" variant="outline" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" disabled={!data?.configured} asChild={data?.configured}>
            {data?.configured ? (
              <a href="/api/admin/google-drive/connect">Connect Google Drive</a>
            ) : (
              <span>Connect Google Drive</span>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
