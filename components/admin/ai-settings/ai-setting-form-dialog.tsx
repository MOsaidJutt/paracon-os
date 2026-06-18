"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVIDERS } from "@/lib/validations/ai-setting";

export type AiSettingRow = {
  id: string;
  scope: "GLOBAL" | "ORG" | "FEATURE";
  feature: string | null;
  provider: string;
  model: string;
  baseUrl: string | null;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  monthlySpendCapUsd: number | null;
  hasKey: boolean;
};

const formSchema = z.object({
  scope: z.enum(["GLOBAL", "ORG", "FEATURE"]),
  feature: z.string().optional(),
  provider: z.enum(PROVIDERS),
  model: z.string().min(1, "Model is required"),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.coerce.number().min(0).max(2),
  maxTokens: z.coerce.number().int().min(1).max(128_000),
  enabled: z.boolean(),
  monthlySpendCapUsd: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AiSettingFormDialog({
  open,
  onOpenChange,
  setting,
  apiBase = "/api/admin/ai-settings",
  queryKey = ["admin", "ai-settings"],
  lockScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setting?: AiSettingRow | null;
  /** Where to POST/PATCH/DELETE — org admin vs super admin GLOBAL endpoint. */
  apiBase?: string;
  queryKey?: string[];
  /** When set, the scope select is hidden and forced to this value (super admin GLOBAL-only screen). */
  lockScope?: "GLOBAL";
}) {
  const queryClient = useQueryClient();
  const isEdit = !!setting;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scope: lockScope ?? "ORG",
      feature: "",
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "",
      baseUrl: "",
      temperature: 0.7,
      maxTokens: 2000,
      enabled: true,
      monthlySpendCapUsd: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        scope: setting?.scope ?? lockScope ?? "ORG",
        feature: setting?.feature ?? "",
        provider: (setting?.provider as FormValues["provider"]) ?? "openai",
        model: setting?.model ?? "gpt-4o-mini",
        apiKey: "",
        baseUrl: setting?.baseUrl ?? "",
        temperature: setting?.temperature ?? 0.7,
        maxTokens: setting?.maxTokens ?? 2000,
        enabled: setting?.enabled ?? true,
        monthlySpendCapUsd: setting?.monthlySpendCapUsd ?? undefined,
      });
    }
  }, [open, setting, lockScope, form]);

  const scope = form.watch("scope");

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const url = isEdit ? `${apiBase}/${setting!.id}` : apiBase;
      const method = isEdit ? "PATCH" : "POST";
      const payload = { ...values, feature: values.scope === "FEATURE" ? values.feature : undefined };

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
      toast.success(isEdit ? "AI setting updated" : "AI setting created");
      queryClient.invalidateQueries({ queryKey });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit AI setting" : "Add AI setting"}</DialogTitle>
          <DialogDescription>
            Provider, model and key are resolved FEATURE → ORG → GLOBAL at call time. Nothing
            here is hard-coded into the app.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            {lockScope ? (
              <p className="text-sm text-muted-foreground">
                Scope: <span className="font-medium text-foreground">Global (platform default)</span>
              </p>
            ) : (
              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scope</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isEdit}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ORG">Organisation</SelectItem>
                        <SelectItem value="FEATURE">Feature override</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {scope === "FEATURE" && (
              <FormField
                control={form.control}
                name="feature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feature key</FormLabel>
                    <FormControl>
                      <Input placeholder="weekly_briefing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
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
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="gpt-4o-mini" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API key</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={isEdit && setting?.hasKey ? "•••••••••••••• (unchanged)" : "sk-..."}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Stored encrypted at rest. Leave blank to keep the existing key.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base URL (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.openai.com/v1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min={0} max={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max tokens</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="monthlySpendCapUsd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly spend cap (USD, optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                  <FormLabel className="!mt-0">Enabled</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
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
