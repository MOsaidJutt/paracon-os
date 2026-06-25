import { z } from "zod";

const isoDateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const attendanceItemSchema = z.object({
  workerId: z.string().min(1),
  present: z.boolean(),
  hours: z.number().min(0).max(24).optional().nullable(),
});

export const taskProgressItemSchema = z.object({
  programActivityId: z.string().min(1),
  status: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

export const deliveryConfirmationItemSchema = z.object({
  deliveryId: z.string().min(1),
  status: z.string().min(1),
});

// The vision doc's literal Required/Optional split for a Daily Update:
// Required: Crew Today, Progress. Optional: Issue, Photo, Note. "Progress" is
// satisfied either by ticking at least one task, or — for a day with no
// active program activity to tick (between trades) — a non-empty note.
export const dailyUpdateSubmitSchema = z
  .object({
    projectId: z.string().min(1),
    date: isoDateOnly,
    note: z.string().max(1000).optional().nullable(),
    attendance: z.array(attendanceItemSchema).min(1, "At least one crew attendance entry is required"),
    taskProgress: z.array(taskProgressItemSchema).default([]),
    deliveryConfirmations: z.array(deliveryConfirmationItemSchema).default([]),
  })
  .refine((data) => data.taskProgress.length > 0 || !!data.note?.trim(), {
    message: "Progress is required: tick at least one task, or add a note",
    path: ["taskProgress"],
  });

export const siteTodayQuerySchema = z.object({
  date: isoDateOnly.optional(),
});

export const photoUploadFieldsSchema = z.object({
  projectId: z.string().min(1),
  date: isoDateOnly,
  caption: z.string().max(200).optional().nullable(),
  tag: z.string().min(1),
  clientRef: z.string().max(100).optional().nullable(),
});

export const issueRaiseSchema = z.object({
  projectId: z.string().min(1),
  date: isoDateOnly,
  description: z.string().min(1, "Description is required").max(1000),
  severity: z.string().min(1),
  photoStoredFileIds: z.array(z.string()).default([]),
  clientRef: z.string().max(100).optional().nullable(),
});

export type AttendanceItemInput = z.infer<typeof attendanceItemSchema>;
export type TaskProgressItemInput = z.infer<typeof taskProgressItemSchema>;
export type DeliveryConfirmationItemInput = z.infer<typeof deliveryConfirmationItemSchema>;
export type DailyUpdateSubmitInput = z.infer<typeof dailyUpdateSubmitSchema>;
export type PhotoUploadFieldsInput = z.infer<typeof photoUploadFieldsSchema>;
export type IssueRaiseInput = z.infer<typeof issueRaiseSchema>;
