"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { TenderDocumentActions } from "@/components/documents/generated/tender-document-actions";
import { ClientCombobox, type ClientOption } from "@/components/contacts/client-combobox";
import type { TenderConfig } from "@/lib/tenders/config";

export type TenderRow = {
  id: string;
  projectName: string;
  address: string | null;
  status: string;
  received: string | null;
  due: string | null;
  submitted: string | null;
  value: number;
  clientId: string;
  contactId: string | null;
  winProbabilityText: string;
  bidDecision: string;
  intent: string;
  reason: string | null;
  outcome: string | null;
  winningBid: number | null;
  winningCo: string | null;
  priceDeltaPct: number | null;
  marginPct: number | null;
  project?: { id: string; code: string } | null;
};

const formSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  address: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  received: z.string().optional(),
  due: z.string().optional(),
  submitted: z.string().optional(),
  value: z.coerce.number().min(0),
  clientId: z.string().min(1, "Client is required"),
  contactId: z.string().optional(),
  winProbabilityText: z.string().min(1, "Win probability is required"),
  bidDecision: z.string().min(1, "Bid decision is required"),
  intent: z.string().min(1, "Intent is required"),
  reason: z.string().optional(),
  outcome: z.string().optional(),
  winningBid: z.coerce.number().optional(),
  winningCo: z.string().optional(),
  priceDeltaPct: z.coerce.number().optional(),
  marginPct: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_DEFAULTS: FormValues = {
  projectName: "",
  address: "",
  status: "",
  received: "",
  due: "",
  submitted: "",
  value: 0,
  clientId: "",
  contactId: "",
  winProbabilityText: "",
  bidDecision: "",
  intent: "",
  reason: "",
  outcome: "",
  winningBid: undefined,
  winningCo: "",
  priceDeltaPct: undefined,
  marginPct: undefined,
};

function toFormValues(tender: TenderRow): FormValues {
  return {
    projectName: tender.projectName,
    address: tender.address ?? "",
    status: tender.status,
    received: tender.received?.slice(0, 10) ?? "",
    due: tender.due?.slice(0, 10) ?? "",
    submitted: tender.submitted?.slice(0, 10) ?? "",
    value: tender.value,
    clientId: tender.clientId,
    contactId: tender.contactId ?? "",
    winProbabilityText: tender.winProbabilityText,
    bidDecision: tender.bidDecision,
    intent: tender.intent,
    reason: tender.reason ?? "",
    outcome: tender.outcome ?? "",
    winningBid: tender.winningBid ?? undefined,
    winningCo: tender.winningCo ?? "",
    priceDeltaPct: tender.priceDeltaPct ?? undefined,
    marginPct: tender.marginPct ?? undefined,
  };
}

export function TenderFormSheet({
  open,
  onOpenChange,
  tender,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tender?: TenderRow | null;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const isEdit = !!tender;

  const { data: config } = useQuery({
    queryKey: ["tenders", "config"],
    queryFn: async () => {
      const res = await fetch("/api/tenders/config");
      if (!res.ok) throw new Error("Failed to load tender config");
      return (await res.json()) as TenderConfig;
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ["contacts", "clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      return (await res.json()) as { clients: ClientOption[] };
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY_DEFAULTS });

  useEffect(() => {
    if (open) form.reset(tender ? toFormValues(tender) : EMPTY_DEFAULTS);
  }, [open, tender, form]);

  const selectedClientId = form.watch("clientId");
  const contacts = clientsData?.clients.find((c) => c.id === selectedClientId)?.contacts ?? [];

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        address: values.address || null,
        received: values.received || null,
        due: values.due || null,
        submitted: values.submitted || null,
        contactId: values.contactId || null,
        reason: values.reason || null,
        outcome: values.outcome || null,
        winningCo: values.winningCo || null,
        winningBid: values.winningBid ?? null,
        priceDeltaPct: values.priceDeltaPct ?? null,
        marginPct: values.marginPct ?? null,
      };
      const url = isEdit ? `/api/tenders/${tender!.id}` : "/api/tenders";
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
      toast.success(isEdit ? "Tender updated" : "Tender created");
      queryClient.invalidateQueries({ queryKey: ["tenders"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenders/${tender!.id}/convert-to-project`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to convert tender");
      }
      return (await res.json()) as { project: { id: string } };
    },
    onSuccess: ({ project }) => {
      toast.success("Project created from tender");
      queryClient.invalidateQueries({ queryKey: ["tenders"] });
      onOpenChange(false);
      router.push(`/projects/${project.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit tender" : "New tender"}</SheetTitle>
          <SheetDescription>
            Win probability, value band, year/quarter and duration are derived automatically from the
            Config registry — no need to set them by hand.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="mt-4 flex flex-col gap-4">
            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project name</FormLabel>
                  <FormControl>
                    <Input placeholder="L37 & 38 Fitout" {...field} />
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
                  <FormLabel>Project address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <ClientCombobox value={field.value} onChange={(id) => field.onChange(id)} placeholder="Select client" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={contacts.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value ($)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={1000} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="received"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="due"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="submitted"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submitted</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="winProbabilityText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Win probability</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config && Object.keys(config.winProbWeights).map((key) => (
                          <SelectItem key={key} value={key}>
                            {key}
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
                name="bidDecision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bid decision</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.bidDecisionList.map((s) => (
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="intent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intent</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.intentList.map((s) => (
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
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outcome</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not yet resolved" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.outcomeList.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason / notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="winningBid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Winning bid ($)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="winningCo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Winning company</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priceDeltaPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price delta (%)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="marginPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Margin (%)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {isEdit && tender!.status === "Won" && (
              <div className="rounded-lg border border-border p-3">
                {tender!.project ? (
                  <Button type="button" variant="outline" className="w-full" asChild>
                    <a href={`/projects/${tender!.project.id}`}>View project {tender!.project.code}</a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={convertMutation.isPending}
                    onClick={() => convertMutation.mutate()}
                  >
                    {convertMutation.isPending ? "Converting..." : "Convert to project"}
                  </Button>
                )}
              </div>
            )}

            <SheetFooter className="mt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save"}
              </Button>
            </SheetFooter>
          </form>
        </Form>

        {isEdit && (
          <>
            <Separator className="my-6" />
            <TenderDocumentActions tenderId={tender!.id} />
            <DocumentsPanel target={{ tenderId: tender!.id }} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
