"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LabourConfig } from "@/lib/labour/config";

const formSchema = z.object({
  type: z.string().min(1, "Type is required"),
  reference: z.string().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_DEFAULTS: FormValues = { type: "", reference: "", issuedDate: "", expiryDate: "" };

export function ComplianceFormSheet({
  open,
  onOpenChange,
  workerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
}) {
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["labour", "config"],
    queryFn: async () => {
      const res = await fetch("/api/labour/config");
      if (!res.ok) throw new Error("Failed to load labour config");
      return (await res.json()) as LabourConfig;
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY_DEFAULTS });

  useEffect(() => {
    if (open) form.reset(EMPTY_DEFAULTS);
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        type: values.type,
        reference: values.reference || null,
        issuedDate: values.issuedDate || null,
        expiryDate: values.expiryDate || null,
      };
      const res = await fetch(`/api/workers/${workerId}/compliance`, {
        method: "POST",
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
      toast.success("Compliance record added");
      queryClient.invalidateQueries({ queryKey: ["labour"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add compliance record</SheetTitle>
          <SheetDescription>Status (Valid/Expiring/Expired) is computed automatically from the expiry date.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="mt-4 flex flex-col gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {config?.complianceTypeList.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
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
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference / number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issuedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issued date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SheetFooter className="mt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
