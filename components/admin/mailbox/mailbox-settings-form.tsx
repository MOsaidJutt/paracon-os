"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type MailboxSetting = {
  id: string;
  host: string;
  port: number;
  username: string;
  useTls: boolean;
  folder: string;
  enabled: boolean;
  lastPolledAt: string | null;
  hasPassword: boolean;
} | null;

const EMPTY = { host: "", port: 993, username: "", password: "", useTls: true, folder: "INBOX", enabled: false };

export function MailboxSettingsForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "mailbox-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/mailbox-settings");
      if (!res.ok) throw new Error("Failed to load mailbox settings");
      return (await res.json()) as { setting: MailboxSetting };
    },
  });

  useEffect(() => {
    if (data?.setting) {
      setForm({
        host: data.setting.host,
        port: data.setting.port,
        username: data.setting.username,
        password: "",
        useTls: data.setting.useTls,
        folder: data.setting.folder,
        enabled: data.setting.enabled,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/mailbox-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, password: form.password || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save mailbox settings");
      }
    },
    onSuccess: () => {
      toast.success("Mailbox settings saved");
      setForm((f) => ({ ...f, password: "" }));
      queryClient.invalidateQueries({ queryKey: ["admin", "mailbox-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/mailbox-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.password ? { password: form.password } : {}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Connection failed");
      }
    },
    onSuccess: () => toast.success("Connected successfully"),
    onError: (error: Error) => toast.error(error.message),
  });

  const pollNow = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/mailbox-settings/poll-now", { method: "POST" });
      if (!res.ok) throw new Error("Failed to trigger poll");
    },
    onSuccess: () => toast.success("Poll requested — new bills will appear in the Bills Inbox shortly"),
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Accounts inbox (auto-pull supplier bills)</CardTitle>
        <CardDescription>
          The dedicated IMAP inbox supplier invoices arrive at. Polled every 5 minutes — each new email lands in the
          Bills Inbox automatically, matched to a project by job number where possible. Credentials are encrypted at
          rest.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mailbox-host">Host</Label>
            <Input id="mailbox-host" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="imap.example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mailbox-port">Port</Label>
            <Input
              id="mailbox-port"
              type="number"
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mailbox-username">Username</Label>
            <Input id="mailbox-username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mailbox-password">Password</Label>
            <Input
              id="mailbox-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={data?.setting?.hasPassword ? "Leave blank to keep the current password" : ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mailbox-folder">Folder</Label>
            <Input id="mailbox-folder" value={form.folder} onChange={(e) => setForm((f) => ({ ...f, folder: e.target.value }))} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="mailbox-tls" className="text-sm">Use TLS</Label>
            <Switch id="mailbox-tls" checked={form.useTls} onCheckedChange={(checked) => setForm((f) => ({ ...f, useTls: checked }))} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <Label htmlFor="mailbox-enabled" className="text-sm">Enabled</Label>
            <p className="text-xs text-muted-foreground">Turns the 5-minute auto-pull poll on or off for this org.</p>
          </div>
          <Switch id="mailbox-enabled" checked={form.enabled} onCheckedChange={(checked) => setForm((f) => ({ ...f, enabled: checked }))} />
        </div>

        {data?.setting?.lastPolledAt && (
          <p className="text-xs text-muted-foreground">Last polled {new Date(data.setting.lastPolledAt).toLocaleString("en-AU")}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" disabled={testConnection.isPending} onClick={() => testConnection.mutate()}>
            {testConnection.isPending ? "Testing..." : "Test connection"}
          </Button>
          <Button size="sm" variant="outline" disabled={pollNow.isPending} onClick={() => pollNow.mutate()}>
            {pollNow.isPending ? "Requesting..." : "Poll now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
