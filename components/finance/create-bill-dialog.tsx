"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Project = { id: string; name: string; code: string };
type Supplier = { id: string; company: string };

export function CreateBillDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [amountExGst, setAmountExGst] = useState("");
  const [gstAmount, setGstAmount] = useState("");

  useEffect(() => {
    if (open) {
      setFile(null);
      setProjectId("");
      setSupplierId("");
      setInvoiceNumber("");
      setInvoiceDate("");
      setAmountExGst("");
      setGstAmount("");
    }
  }, [open]);

  const { data: projectsData } = useQuery({
    queryKey: ["projects", "all"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return (await res.json()) as { projects: Project[] };
    },
  });

  const { data: suppliersData } = useQuery({
    queryKey: ["finance", "suppliers"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/finance/suppliers");
      if (!res.ok) throw new Error("Failed to load suppliers");
      return (await res.json()) as { suppliers: Supplier[] };
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose the bill file first");
      if (!projectId) throw new Error("Select a project first");
      const mime = file.type || "application/pdf";

      const upload = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mime, size: file.size, category: "Quotes & Purchase Orders", projectId }),
      });
      if (!upload.ok) {
        const body = await upload.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start upload");
      }
      const { key, uploadUrl } = (await upload.json()) as { key: string; uploadUrl: string };

      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      const register = await fetch("/api/documents/stored", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, fileName: file.name, mime, size: file.size, category: "Quotes & Purchase Orders", projectId }),
      });
      if (!register.ok) throw new Error("Failed to register the bill file");
      const { file: stored } = (await register.json()) as { file: { id: string } };
      const fileId = stored.id;

      const exGst = Number(amountExGst) || 0;
      const gst = Number(gstAmount) || 0;

      const res = await fetch("/api/finance/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId || null,
          supplierId: supplierId || null,
          billFileId: fileId,
          invoiceNumber: invoiceNumber || null,
          invoiceDate: invoiceDate || null,
          amountExGst: exGst,
          gstAmount: gst,
          amountIncGst: exGst + gst,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create bill");
      }
    },
    onSuccess: () => {
      toast.success("Bill added");
      queryClient.invalidateQueries({ queryKey: ["finance", "bills"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add supplier bill manually</DialogTitle>
          <DialogDescription>For bills that didn&apos;t arrive through the accounts inbox.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-file">Bill file</Label>
            <Input id="bill-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-bill-project">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="create-bill-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(projectsData?.projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-bill-supplier">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="create-bill-supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {(suppliersData?.suppliers ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bill-invoice-number">Invoice number</Label>
              <Input id="bill-invoice-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bill-invoice-date">Invoice date</Label>
              <Input id="bill-invoice-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bill-amount-ex">Amount (ex GST)</Label>
              <Input id="bill-amount-ex" type="number" min={0} value={amountExGst} onChange={(e) => setAmountExGst(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bill-gst">GST</Label>
              <Input id="bill-gst" type="number" min={0} value={gstAmount} onChange={(e) => setGstAmount(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!file || !projectId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving..." : "Add bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
