"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/tenders/format";

type LeaveRow = { id: string; startDate: string; endDate: string; reason: string | null };

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const formSchema = z
  .object({ startDate: z.string().min(1), endDate: z.string().min(1), reason: z.string().optional() })
  .refine((data) => data.endDate >= data.startDate, { message: "End date must be on or after start", path: ["endDate"] });

type FormValues = z.infer<typeof formSchema>;

export function AvailabilityCalendar({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const today = useMemo(() => new Date(), []);

  const { data } = useQuery({
    queryKey: ["labour", "worker", workerId, "leave"],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${workerId}/leave`);
      if (!res.ok) throw new Error("Failed to load leave");
      return (await res.json()) as { leave: LeaveRow[] };
    },
  });
  const leave = data?.leave ?? [];

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { startDate: "", endDate: "", reason: "" } });

  const addMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch(`/api/workers/${workerId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, reason: values.reason || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Leave added");
      form.reset({ startDate: "", endDate: "", reason: "" });
      queryClient.invalidateQueries({ queryKey: ["labour", "worker", workerId, "leave"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const res = await fetch(`/api/workers/${workerId}/leave/${leaveId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Delete failed");
      }
    },
    onSuccess: () => {
      toast.success("Leave removed");
      queryClient.invalidateQueries({ queryKey: ["labour", "worker", workerId, "leave"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const days = useMemo(() => {
    const firstOfMonth = startOfMonth(monthAnchor);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - firstWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return date;
    });
  }, [monthAnchor]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-heading text-sm font-semibold text-foreground">
              {monthAnchor.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border text-xs font-medium text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-2 py-1.5 text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const inMonth = day.getMonth() === monthAnchor.getMonth();
              const isToday = isSameDay(day, today);
              const onLeave = leave.some((l) => day >= new Date(l.startDate) && day <= new Date(l.endDate));

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-16 border-b border-r border-border p-1.5",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    onLeave && "bg-rag-amber/10"
                  )}
                >
                  <span className={cn("text-xs", isToday && "font-bold text-brass-deep")}>{day.getDate()}</span>
                  {onLeave && <div className="mt-1 rounded bg-rag-amber/20 px-1 text-[10px] font-medium text-rag-amber">Leave</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <h3 className="text-sm font-semibold text-foreground">Leave periods</h3>
          {leave.length === 0 && <p className="text-sm text-muted-foreground">No leave on record.</p>}
          {leave.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-md border border-border p-2">
              <span className="text-sm text-foreground">
                {formatDate(l.startDate)} – {formatDate(l.endDate)}
                {l.reason ? ` · ${l.reason}` : ""}
              </span>
              <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => deleteMutation.mutate(l.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}
              className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
            >
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="Annual leave" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" size="sm" disabled={addMutation.isPending}>
                <Plus className="size-4" />
                Add leave
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
