import { z } from "zod";

// Originally just "director" | "pm" (the two dashboards). Generalized to any
// bounded, safe-charset key so the same per-user layout storage can back
// register column preferences ("register:tenders") and per-project Gantt
// view toggles ("gantt:<projectId>") without a schema change — the
// DashboardLayout table's dashboardKey column was always a plain string.
export const dashboardKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9:_-]+$/, "dashboardKey may only contain letters, numbers, ':', '_' and '-'");

export const dashboardLayoutWidgetSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
});

export const dashboardLayoutSchema = z.object({
  dashboardKey: dashboardKeySchema,
  widgets: z.array(dashboardLayoutWidgetSchema).min(1),
});

export type DashboardLayoutInput = z.infer<typeof dashboardLayoutSchema>;
