import { z } from "zod";
import { prisma } from "./prisma";

/**
 * Which of the two views a user is currently in.
 *
 * SIMPLE is the default everyone lands on after login: the five-module
 * presentation layer (Dashboard, Prospects, Pre-Construction, Projects,
 * Directory) over exactly the same data, server actions and business logic.
 * FULL is everything built through phases 0-18, unchanged.
 *
 * This is a *view* preference, never an authorisation one — switching view
 * changes which screens are surfaced in the nav, never what a user is allowed
 * to read or write. Every route keeps its own requirePermission check.
 */
export const VIEW_MODES = ["SIMPLE", "FULL"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const DEFAULT_VIEW_MODE: ViewMode = "SIMPLE";

export const VIEW_MODE_PREFERENCE_KEY = "view.mode";

export const viewModeSchema = z.enum(VIEW_MODES);

export function parseViewMode(value: unknown): ViewMode {
  const parsed = viewModeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_VIEW_MODE;
}

/**
 * Reads a user's stored view mode, falling back to SIMPLE for anyone who has
 * never toggled — which is what makes the simplified view "the default
 * everyone lands on" without a backfill.
 */
export async function getViewMode(organisationId: string, userId: string): Promise<ViewMode> {
  const row = await prisma.userPreference.findUnique({
    where: {
      organisationId_userId_key: { organisationId, userId, key: VIEW_MODE_PREFERENCE_KEY },
    },
    select: { valueJson: true },
  });
  return parseViewMode(row?.valueJson);
}
