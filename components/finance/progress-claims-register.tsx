"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/tenders/format";

type ProgressClaimRow = {
  id: string;
  number: string;
  claimedAmountExGst: number;
  status: string;
  certifiedAmount: number | null;
  paidAmount: number;
  retentionHeld: number;
  statDeclarationFileId: string | null;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Paid" || status === "Certified") return "default";
  return "secondary";
}

async function uploadStatDeclaration(file: File, projectId: string): Promise<string> {
  const mime = file.type || "application/pdf";
  const upload = await fetch("/api/documents/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mime, size: file.size, category: "Submission, Contract & Claims", tags: [], projectId }),
  });
  if (!upload.ok) throw new Error("Failed to start upload");
  const { key, uploadUrl } = (await upload.json()) as { key: string; uploadUrl: string };

  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
  if (!putRes.ok) throw new Error("Upload to storage failed");

  const register = await fetch("/api/documents/stored", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, fileName: file.name, mime, size: file.size, category: "Submission, Contract & Claims", tags: [], projectId }),
  });
  if (!register.ok) throw new Error("Failed to register document");
  const { file: storedFile } = (await register.json()) as { file: { id: string } };
  return storedFile.id;
}

export function ProgressClaimsRegister({ projectId, canApprove }: { projectId: string; canApprove: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachingClaimId, setAttachingClaimId] = useState<string | null>(null);
  const [amountDialog, setAmountDialog] = useState<{ claimId: string; action: "certify" | "pay" } | null>(null);
  const [amountValue, setAmountValue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "progress-claims", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/finance/progress-claims?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to load progress claims");
      return (await res.json()) as { claims: ProgressClaimRow[] };
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["finance", "progress-claims", projectId] });
  }

  const action = useMutation({
    mutationFn: async ({ claimId, path, body }: { claimId: string; path: string; body?: unknown }) => {
      const res = await fetch(`/api/finance/progress-claims/${claimId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Action failed");
      }
    },
    onSuccess: () => {
      toast.success("Progress claim updated");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !attachingClaimId) return;
    try {
      const fileId = await uploadStatDeclaration(file, projectId);
      await action.mutateAsync({ claimId: attachingClaimId, path: "attach-stat-declaration", body: { statDeclarationFileId: fileId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to attach statutory declaration");
    }
    setAttachingClaimId(null);
  }

  function submitAmount() {
    if (!amountDialog) return;
    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amountDialog.action === "certify") {
      action.mutate({ claimId: amountDialog.claimId, path: "certify", body: { certifiedAmount: amount } });
    } else {
      action.mutate({ claimId: amountDialog.claimId, path: "pay", body: { paidAmount: amount } });
    }
    setAmountDialog(null);
    setAmountValue("");
  }

  const claims = data?.claims ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Progress Claims</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-md bg-muted/40" />
        ) : claims.length === 0 ? (
          <p className="text-sm text-muted-foreground">No progress claims yet — generate one from the Documents tab.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Claimed</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Certified</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  {canApprove && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">{c.number}</TableCell>
                    <TableCell>{formatCurrency(c.claimedAmountExGst)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(c.retentionHeld)}</TableCell>
                    <TableCell className="text-muted-foreground">{c.certifiedAmount != null ? formatCurrency(c.certifiedAmount) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(c.paidAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                    </TableCell>
                    {canApprove && (
                      <TableCell className="flex justify-end gap-1.5">
                        {c.status === "Draft" && (
                          <Button size="sm" variant="outline" onClick={() => action.mutate({ claimId: c.id, path: "submit-review" })}>
                            Submit for review
                          </Button>
                        )}
                        {c.status === "Under review" && !c.statDeclarationFileId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAttachingClaimId(c.id);
                              fileInputRef.current?.click();
                            }}
                          >
                            <Paperclip className="size-3.5" />
                            Attach declaration
                          </Button>
                        )}
                        {c.status === "Under review" && c.statDeclarationFileId && (
                          <Button size="sm" variant="outline" onClick={() => action.mutate({ claimId: c.id, path: "approve" })}>
                            Approve
                          </Button>
                        )}
                        {c.status === "Approved" && (
                          <Button size="sm" variant="outline" onClick={() => action.mutate({ claimId: c.id, path: "issue" })}>
                            Issue
                          </Button>
                        )}
                        {c.status === "Issued" && (
                          <Button size="sm" variant="outline" onClick={() => setAmountDialog({ claimId: c.id, action: "certify" })}>
                            Certify
                          </Button>
                        )}
                        {(c.status === "Issued" || c.status === "Certified") && (
                          <Button size="sm" variant="outline" onClick={() => setAmountDialog({ claimId: c.id, action: "pay" })}>
                            Record payment
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleAttachFile} />

      <Dialog open={!!amountDialog} onOpenChange={(open) => !open && setAmountDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{amountDialog?.action === "certify" ? "Certified amount" : "Payment amount"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount-input">Amount (ex GST)</Label>
            <Input id="amount-input" type="number" min={0} value={amountValue} onChange={(e) => setAmountValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={submitAmount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
