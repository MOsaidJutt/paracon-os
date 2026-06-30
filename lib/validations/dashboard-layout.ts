import { z } from "zod";

export const dashboardKeySchema = z.enum(["director", "pm"]);

export const dashboardLayoutWidgetSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
});

export const dashboardLayoutSchema = z.object({
  dashboardKey: dashboardKeySchema,
  widgets: z.array(dashboardLayoutWidgetSchema).min(1),
});

export type DashboardLayoutInput = z.infer<typeof dashboardLayoutSchema>;
