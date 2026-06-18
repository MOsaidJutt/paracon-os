"use client";

import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import type { TenderConfig } from "@/lib/tenders/config";

export type ClientRow = {
  id: string;
  name: string;
  address: string | null;
  status: string;
  contacts: { id: string; name: string; position: string | null; email: string | null; phone: string | null; mobile: string | null }[];
};

const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  position: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  mobile: z.string().optional(),
});

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  contacts: z.array(contactSchema),
});

type FormValues = z.infer<typeof formSchema>;

function toFormValues(client?: ClientRow | null): FormValues {
  return {
    name: client?.name ?? "",
    address: client?.address ?? "",
    status: client?.status ?? "",
    contacts:
      client?.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        mobile: c.mobile ?? "",
      })) ?? [],
  };
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!client;

  const { data: config } = useQuery({
    queryKey: ["tenders", "config"],
    queryFn: async () => {
      const res = await fetch("/api/tenders/config");
      if (!res.ok) throw new Error("Failed to load tender config");
      return (await res.json()) as TenderConfig;
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toFormValues() });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "contacts" });

  useEffect(() => {
    if (open) form.reset(toFormValues(client));
  }, [open, client, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        address: values.address || null,
        contacts: values.contacts.map((c) => ({ ...c, email: c.email || null })),
      };
      const url = isEdit ? `/api/clients/${client!.id}` : "/api/clients";
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
      toast.success(isEdit ? "Client updated" : "Client created");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>A head contractor and the people you deal with there.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Buildcorp Group" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      {config?.clientStatusList.map((s) => (
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

            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Contacts</p>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", position: "", email: "", phone: "", mobile: "" })}>
                <Plus className="size-4" />
                Add contact
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.position`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Position</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.email`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Email</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.phone`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Phone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.mobile`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Mobile</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove contact">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

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
