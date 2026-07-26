import { z } from "zod";

/**
 * The per-user preferences reachable through /api/preferences/[key].
 *
 * An allowlist rather than a free-for-all: without one, the endpoint would let
 * a client write arbitrary keys and values into UserPreference, which is a
 * storage-injection hole dressed up as a convenience. A new preference is a new
 * entry here plus its schema — still no migration, which is the point of the
 * generic store.
 *
 * The view mode keeps its own dedicated route (/api/preferences/view-mode),
 * since it existed first and is read server-side on every shell render.
 */
export const PREFERENCE_SCHEMAS = {
  /** Prospects register: board lanes or a dense table. */
  "prospects.view": z.enum(["BOARD", "LIST"]),
  /** Pre-Construction: the working tender register, or the bid-intelligence dashboard. */
  "preconstruction.view": z.enum(["REGISTER", "INTEL"]),
  /** Projects: the project register list, or the multi-project stacked Gantt. */
  "projects.view": z.enum(["LIST", "GANTT"]),
} as const;

export type PreferenceKey = keyof typeof PREFERENCE_SCHEMAS;

export const preferenceKeySchema = z.enum(
  Object.keys(PREFERENCE_SCHEMAS) as [PreferenceKey, ...PreferenceKey[]]
);

export const PREFERENCE_DEFAULTS: { [K in PreferenceKey]: z.infer<(typeof PREFERENCE_SCHEMAS)[K]> } = {
  // Board first: it makes cold -> warm literal, which is what the module is for.
  "prospects.view": "BOARD",
  // The register is the day-to-day working surface; Intel is analysis someone
  // opts into, not the thing they land on.
  "preconstruction.view": "REGISTER",
  // The list is the day-to-day register; the Gantt is opted into for schedule review.
  "projects.view": "LIST",
};

/** Parses a stored value, falling back to the default rather than throwing — a bad preference must never break a page. */
export function parsePreference<K extends PreferenceKey>(key: K, value: unknown): z.infer<(typeof PREFERENCE_SCHEMAS)[K]> {
  const parsed = PREFERENCE_SCHEMAS[key].safeParse(value);
  return (parsed.success ? parsed.data : PREFERENCE_DEFAULTS[key]) as z.infer<(typeof PREFERENCE_SCHEMAS)[K]>;
}
