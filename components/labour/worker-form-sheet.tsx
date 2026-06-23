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

export type WorkerRow = {
  id: string;
  name: string;
  phone: string | null;
  capability: string;
  employmentType: string;
  status: string;
  baseLocation: string | null;
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  capability: z.string().min(1, "Capability is required"),
  employmentType: z.string().min(1, "Employment type is required"),
  status: z.string().min(1, "Status is required"),
  baseLocation: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_DEFAULTS: FormValues = {
  name: "",
  phone: "",
  capability: "",
  employmentType: "",
  status: "Available",
  baseLocation: "",
};

function toFormValues(worker: WorkerRow): FormValues {
  return {
    name: worker.name,
    phone: worker.phone ?? "",
    capability: worker.capability,
    employmentType: worker.employmentType,
    status: worker.status,
    baseLocation: worker.baseLocation ?? "",
  };
}

export function WorkerFormSheet({
  open,
  onOpenChange,
  worker,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker?: WorkerRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!worker;

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
    if (open) form.reset(worker ? toFormValues(worker) : EMPTY_DEFAULTS);
  }, [open, worker, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        phone: values.phone || null,
        baseLocation: values.baseLocation || null,
      };
      const url = isEdit ? `/api/workers/${worker!.id}` : "/api/workers";
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
      toast.success(isEdit ? "Worker updated" : "Worker added");
      queryClient.invalidateQueries({ queryKey: ["labour"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit worker" : "Add worker"}</SheetTitle>
          <SheetDescription>Core worker details. Add compliance docs and skills from their profile.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="mt-4 flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jordan Mills" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capability</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select capability" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.capabilityList.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
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
                name="employmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.employmentTypeList.map((t) => (
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.statusList.map((s) => (
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="0400 000 000" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="baseLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base location</FormLabel>
                  <FormControl>
                    <Input placeholder="North Melbourne" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

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
