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
import type { ProspectConfig } from "@/lib/prospects/config";

export type ProspectRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  estimatedValue: number | null;
  stage: string;
  notes: string | null;
  convertedTenderId: string | null;
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  estimatedValue: z.string().optional(),
  stage: z.string().min(1, "Stage is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function toFormValues(prospect?: ProspectRow | null): FormValues {
  return {
    name: prospect?.name ?? "",
    contactName: prospect?.contactName ?? "",
    contactEmail: prospect?.contactEmail ?? "",
    contactPhone: prospect?.contactPhone ?? "",
    address: prospect?.address ?? "",
    estimatedValue: prospect?.estimatedValue != null ? String(prospect.estimatedValue) : "",
    stage: prospect?.stage ?? "",
    notes: prospect?.notes ?? "",
  };
}

export function ProspectFormDialog({
  open,
  onOpenChange,
  prospect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect?: ProspectRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!prospect;

  const { data: config } = useQuery({
    queryKey: ["prospects", "config"],
    queryFn: async () => {
      const res = await fetch("/api/prospects/config");
      if (!res.ok) throw new Error("Failed to load prospect config");
      return (await res.json()) as ProspectConfig;
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toFormValues() });

  useEffect(() => {
    if (open) form.reset(toFormValues(prospect));
  }, [open, prospect, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        contactName: values.contactName || null,
        contactEmail: values.contactEmail || null,
        contactPhone: values.contactPhone || null,
        address: values.address || null,
        estimatedValue: values.estimatedValue ? Number(values.estimatedValue) : null,
        notes: values.notes || null,
      };
      const url = isEdit ? `/api/prospects/${prospect!.id}` : "/api/prospects";
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
      toast.success(isEdit ? "Prospect updated" : "Prospect added");
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit prospect" : "New prospect"}</DialogTitle>
          <DialogDescription>A lead before it&apos;s worth running a tender — convert it once it&apos;s warm.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company / lead name</FormLabel>
                  <FormControl>
                    <Input placeholder="Buildcorp Group" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.stageList.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estimatedValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated value ($)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="1000" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

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
