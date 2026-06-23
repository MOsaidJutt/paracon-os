"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ComplianceBadge } from "./compliance-badge";
import { ComplianceFormSheet } from "./compliance-form-sheet";
import { formatDate } from "@/lib/tenders/format";

export type ComplianceRow = {
  id: string;
  type: string;
  reference: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  docUrl: string | null;
  status: string;
};

function DocUploadButton({ workerId, complianceId }: { workerId: string; complianceId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("doc", file);
      const res = await fetch(`/api/workers/${workerId}/compliance/${complianceId}/doc`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      queryClient.invalidateQueries({ queryKey: ["labour"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <Button variant="ghost" size="icon" className="size-7" onClick={() => inputRef.current?.click()} disabled={mutation.isPending}>
        <Upload className="size-3.5" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) mutation.mutate(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function ComplianceList({ workerId, compliance }: { workerId: string; compliance: ComplianceRow[] }) {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (complianceId: string) => {
      const res = await fetch(`/api/workers/${workerId}/compliance/${complianceId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Delete failed");
      }
    },
    onSuccess: () => {
      toast.success("Compliance record removed");
      queryClient.invalidateQueries({ queryKey: ["labour"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Compliance</h3>
          <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        {compliance.length === 0 && <p className="text-sm text-muted-foreground">No compliance records yet.</p>}

        {compliance.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{c.type}</span>
              <span className="text-xs text-muted-foreground">
                {c.reference ? `${c.reference} · ` : ""}
                Expires {formatDate(c.expiryDate)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ComplianceBadge status={c.status} expiryDate={c.expiryDate} />
              <DocUploadButton workerId={workerId} complianceId={c.id} />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                onClick={() => deleteMutation.mutate(c.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <ComplianceFormSheet open={sheetOpen} onOpenChange={setSheetOpen} workerId={workerId} />
    </Card>
  );
}
