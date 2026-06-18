"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiSettingFormDialog, type AiSettingRow } from "./ai-setting-form-dialog";

export function AiSettingsTable({
  apiBase = "/api/admin/ai-settings",
  queryKey = ["admin", "ai-settings"],
  lockScope,
}: {
  apiBase?: string;
  queryKey?: string[];
  lockScope?: "GLOBAL";
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AiSettingRow | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error("Failed to load AI settings");
      return (await res.json()) as { settings: AiSettingRow[] };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete");
      }
    },
    onSuccess: () => {
      toast.success("AI setting deleted");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`${apiBase}/${id}/test`, { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? "Connection test failed");
      } else {
        toast.success(`Connected in ${body.latencyMs}ms (${body.completionTokens ?? 0} tokens out)`);
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Resolution order when a feature calls <code className="text-xs">getAiClient()</code>:
          FEATURE → ORG → GLOBAL.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add setting
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scope</TableHead>
              <TableHead>Provider / Model</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.settings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No org or feature-level AI settings yet — features fall back to the platform default.
                </TableCell>
              </TableRow>
            )}
            {data?.settings.map((setting) => (
              <TableRow key={setting.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{setting.scope}</span>
                    {setting.feature && (
                      <span className="text-xs text-muted-foreground">{setting.feature}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {setting.provider} / {setting.model}
                </TableCell>
                <TableCell>{setting.hasKey ? "•••••••••••" : "—"}</TableCell>
                <TableCell>
                  <Badge variant={setting.enabled ? "outline" : "secondary"}>
                    {setting.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={testingId === setting.id}
                      onClick={() => handleTest(setting.id)}
                      title="Test connection"
                      aria-label="Test connection"
                    >
                      <Zap className="size-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for ${setting.scope} setting`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(setting);
                            setDialogOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(setting.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AiSettingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        setting={editing}
        apiBase={apiBase}
        queryKey={queryKey}
        lockScope={lockScope}
      />
    </div>
  );
}
