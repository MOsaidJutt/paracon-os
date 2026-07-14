"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AuditTrail } from "@/components/audit/audit-trail";
import { PerformanceRadar, type PerformanceScores } from "@/components/labour/performance-radar";
import { PerformanceEditor } from "@/components/labour/performance-editor";
import type { SupplierConfig } from "@/lib/suppliers/config";

export type SupplierRow = {
  id: string;
  trade: string;
  company: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  comments: string | null;
  kind: string;
  performance?: PerformanceScores | null;
};

const formSchema = z.object({
  trade: z.string().min(1, "Trade is required"),
  company: z.string().min(1, "Company is required"),
  contact: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  comments: z.string().optional(),
  kind: z.string().min(1, "Kind is required"),
});

type FormValues = z.infer<typeof formSchema>;

function toFormValues(supplier?: SupplierRow | null): FormValues {
  return {
    trade: supplier?.trade ?? "",
    company: supplier?.company ?? "",
    contact: supplier?.contact ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    comments: supplier?.comments ?? "",
    kind: supplier?.kind ?? "Supplier",
  };
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!supplier;

  const { data: config } = useQuery({
    queryKey: ["suppliers", "config"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers/config");
      if (!res.ok) throw new Error("Failed to load supplier config");
      return (await res.json()) as SupplierConfig;
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toFormValues() });

  useEffect(() => {
    if (open) form.reset(toFormValues(supplier));
  }, [open, supplier, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, email: values.email || null };
      const url = isEdit ? `/api/suppliers/${supplier!.id}` : "/api/suppliers";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(isEdit ? "Supplier updated" : "Supplier created");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["audit-trail", "Supplier", supplier!.id] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>A trade subcontractor or supplier contact.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select kind" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(config?.kindList ?? ["Supplier", "Subcontractor"]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="trade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade</FormLabel>
                    <FormControl>
                      <Input placeholder="Aluminium" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {isEdit && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {supplier!.kind === "Subcontractor" ? "Subcontractor rating" : "Supplier rating"}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PerformanceRadar
                      scores={supplier!.performance ?? { quality: 0, reliability: 0, productivity: 0, safety: 0 }}
                    />
                    <PerformanceEditor
                      endpoint={`/api/suppliers/${supplier!.id}/performance`}
                      initial={supplier!.performance ?? { quality: 0, reliability: 0, productivity: 0, safety: 0 }}
                      invalidateKey={["suppliers"]}
                    />
                  </div>
                </div>
                <Separator />
                <AuditTrail entityType="Supplier" entityId={supplier!.id} />
              </>
            )}

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
