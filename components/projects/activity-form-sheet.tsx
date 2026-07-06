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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DependencyEditor } from "@/components/schedule/dependency-editor";
import { DelayHistoryList } from "@/components/schedule/delay-history-list";
import { AuditTrail } from "@/components/audit/audit-trail";
import type { ProjectConfig } from "@/lib/projects/config";

export type ActivityRow = {
  id: string;
  parentId: string | null;
  name: string;
  trade: string;
  startDate: string;
  endDate: string;
  isCritical: boolean;
  floatDays: number | null;
  isMilestone: boolean;
  milestoneType: string | null;
  status: string;
  labourRequired: Record<string, number>;
};

const NO_PARENT = "__none__";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  trade: z.string().min(1, "Trade is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  parentId: z.string(),
  isMilestone: z.boolean(),
  milestoneType: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  labour: z.array(z.object({ role: z.string().min(1, "Role is required"), count: z.coerce.number().int().min(0) })),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_DEFAULTS: FormValues = {
  name: "",
  trade: "",
  startDate: "",
  endDate: "",
  parentId: NO_PARENT,
  isMilestone: false,
  milestoneType: "",
  status: "",
  labour: [],
};

function toFormValues(activity: ActivityRow): FormValues {
  return {
    name: activity.name,
    trade: activity.trade,
    startDate: activity.startDate.slice(0, 10),
    endDate: activity.endDate.slice(0, 10),
    parentId: activity.parentId ?? NO_PARENT,
    isMilestone: activity.isMilestone,
    milestoneType: activity.milestoneType ?? "",
    status: activity.status,
    labour: Object.entries(activity.labourRequired).map(([role, count]) => ({ role, count })),
  };
}

export function ActivityFormSheet({
  open,
  onOpenChange,
  projectId,
  activity,
  otherActivities,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  activity?: ActivityRow | null;
  otherActivities: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!activity;

  const { data: config } = useQuery({
    queryKey: ["projects", "config"],
    queryFn: async () => {
      const res = await fetch("/api/projects/config");
      if (!res.ok) throw new Error("Failed to load project config");
      return (await res.json()) as ProjectConfig;
    },
  });

  const { data: dependencyData } = useQuery({
    queryKey: ["projects", projectId, "dependencies"],
    enabled: isEdit,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/dependencies`);
      if (!res.ok) throw new Error("Failed to load dependencies");
      return (await res.json()) as { dependencies: { predecessorId: string; successorId: string }[] };
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY_DEFAULTS });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "labour" });

  useEffect(() => {
    if (open) form.reset(activity ? toFormValues(activity) : EMPTY_DEFAULTS);
  }, [open, activity, form]);

  const isMilestone = form.watch("isMilestone");
  const hasDependency =
    isEdit &&
    !!activity &&
    (dependencyData?.dependencies ?? []).some((d) => d.predecessorId === activity.id || d.successorId === activity.id);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const labourRequired = Object.fromEntries(values.labour.map((l) => [l.role, l.count]));
      const payload = {
        name: values.name,
        trade: values.trade,
        startDate: values.startDate,
        endDate: values.endDate,
        parentId: values.parentId === NO_PARENT ? null : values.parentId,
        isMilestone: values.isMilestone,
        milestoneType: values.isMilestone ? values.milestoneType || null : null,
        status: values.status,
        labourRequired,
      };
      const url = isEdit
        ? `/api/projects/${projectId}/activities/${activity!.id}`
        : `/api/projects/${projectId}/activities`;
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
      toast.success(isEdit ? "Activity updated" : "Activity added");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/activities/${activity!.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete activity");
      }
    },
    onSuccess: () => {
      toast.success("Activity deleted");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit activity" : "New activity"}</SheetTitle>
          <SheetDescription>
            Flagging a task as a milestone adds it to the project&apos;s milestones and the next-30-days dashboard view.
          </SheetDescription>
        </SheetHeader>

        {isEdit && activity && (
          <div className="mt-4 flex items-center gap-2">
            {activity.isCritical ? (
              <Badge variant="destructive">On critical path</Badge>
            ) : activity.floatDays !== null ? (
              <Badge variant="outline">{activity.floatDays} day{activity.floatDays === 1 ? "" : "s"} float</Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">Computed automatically from dependencies — not editable here.</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="mt-4 flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity name</FormLabel>
                  <FormControl>
                    <Input placeholder="Ceiling grid install" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent task</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None (top-level phase)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>None (top-level phase)</SelectItem>
                      {otherActivities
                        .filter((a) => !activity || a.id !== activity.id)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.tradeList.map((t) => (
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
                        {config?.activityStatusList.map((s) => (
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
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isEdit && hasDependency} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isEdit && hasDependency} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {isEdit && (
              <p className="-mt-2 text-xs text-muted-foreground">
                To reschedule a task with dependencies, drag it on the Gantt chart instead — that cascades dependent
                dates and captures a delay reason automatically.
              </p>
            )}

            <FormField
              control={form.control}
              name="isMilestone"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel>Milestone</FormLabel>
                    <p className="text-xs text-muted-foreground">Marks this activity&apos;s end date as a project milestone.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {isMilestone && (
              <FormField
                control={form.control}
                name="milestoneType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milestone type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select milestone type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.milestoneTypeList.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Weekly labour required</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ role: "", count: 1 })}
                >
                  <Plus className="size-3.5" />
                  Add role
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-xs text-muted-foreground">No crew requirement set for this activity yet.</p>
              )}

              {fields.map((item, index) => (
                <div key={item.id} className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`labour.${index}.role`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {config?.tradeList.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`labour.${index}.count`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input type="number" min={0} placeholder="Count" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => remove(index)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {isEdit && activity && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <Label>Dependencies</Label>
                  <DependencyEditor projectId={projectId} activityId={activity.id} otherActivities={otherActivities} />
                </div>

                <Separator />
                <div className="flex flex-col gap-2">
                  <Label>Change history</Label>
                  <DelayHistoryList projectId={projectId} activityId={activity.id} />
                </div>

                <Separator />
                <AuditTrail entityType="ProgramActivity" entityId={activity.id} />
              </>
            )}

            <SheetFooter className="mt-2 flex-row items-center justify-between sm:justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-rag-red hover:text-rag-red"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
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
