import { z } from "zod";

export const createProspectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  contactName: z.string().max(160).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
  contactPhone: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  estimatedValue: z.number().min(0).optional().nullable(),
  stage: z.string().min(1, "Stage is required"),
  // A whole percent, typed by a person rather than computed — "40" is what an
  // estimator writes down. Bounded so a slip of the keyboard can't put a lead
  // at 900% and skew the weighted pipeline figure.
  probability: z.number().int().min(0).max(100).optional().nullable(),
  nextAction: z.string().max(300).optional().nullable(),
  // Accepts the form's ISO date string and hands the route a Date.
  nextActionDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateProspectSchema = createProspectSchema.partial();

/** Dragging a card between board lanes only ever changes the stage. */
export const moveProspectSchema = z.object({
  stage: z.string().min(1, "Stage is required"),
});
