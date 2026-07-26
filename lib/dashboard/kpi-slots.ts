/**
 * The catalogue of metrics that can occupy one of the four north-star ring
 * slots on the simplified dashboard, and the user's chosen four.
 *
 * Every slot is a PERCENTAGE by construction — a ring shows "x% of the way
 * there", so a dollar figure or a raw count has no honest ring representation
 * and belongs in a bar or a figure instead. That constraint is what keeps the
 * slot picker from offering a metric it can't draw.
 *
 * `requires` is the permission slug a user must hold for the slot to be
 * offered and computed; a user without it simply doesn't see that ring, which
 * is how one dashboard serves Director, PM, Estimator and Viewer without
 * forking.
 */
export type KpiSlotId =
  | "revenue-won"
  | "win-rate-value"
  | "win-rate-count"
  | "submission-rate"
  | "labour-utilisation"
  | "projects-on-track"
  | "compliance-current";

export type KpiSlotMeta = {
  id: KpiSlotId;
  title: string;
  /** Plain-English answer to "where does this number come from?", shown in the ring's detail panel. */
  explanation: string;
  requires: string;
};

export const KPI_SLOTS: KpiSlotMeta[] = [
  {
    id: "revenue-won",
    title: "Revenue won",
    explanation:
      "The winning bid value of every tender marked Won, against this organisation's revenue target. The target is an admin setting, not a hard-coded number.",
    requires: "tender.view",
  },
  {
    id: "win-rate-value",
    title: "Win rate",
    explanation:
      "Value of tenders won divided by the value of every tender that has been resolved (won or lost). Tenders still in flight aren't counted either way.",
    requires: "tender.view",
  },
  {
    id: "win-rate-count",
    title: "Win rate (count)",
    explanation: "Number of tenders won divided by the number resolved (won or lost), ignoring their value.",
    requires: "tender.view",
  },
  {
    id: "submission-rate",
    title: "Submission rate",
    explanation: "Tenders that reached Submitted, as a share of every tender on the register.",
    requires: "tender.view",
  },
  {
    id: "labour-utilisation",
    title: "Labour utilised",
    explanation:
      "Committed labour against available labour for the current forecast block, in worker-weeks. 100% means every available worker is already spoken for.",
    requires: "forecast.view",
  },
  {
    id: "projects-on-track",
    title: "Projects on track",
    explanation:
      "Projects whose health reads On Track, out of every live project. Health comes from overdue critical dates, open issues and labour shortfall.",
    requires: "project.view",
  },
  {
    id: "compliance-current",
    title: "Compliance current",
    explanation:
      "Worker compliance documents that are still valid, out of every document on file. Expiring and expired both count against it.",
    requires: "labour.view",
  },
];

export const KPI_SLOT_PREFERENCE_KEY = "dashboard.simple.rings";

/** The four rings a user sees before they customise anything. */
export const DEFAULT_KPI_SLOTS: KpiSlotId[] = [
  "revenue-won",
  "win-rate-value",
  "labour-utilisation",
  "projects-on-track",
];

export const RING_SLOT_COUNT = 4;

const VALID_IDS = new Set<string>(KPI_SLOTS.map((slot) => slot.id));

/**
 * Normalises a stored slot preference into up to four valid, distinct ids.
 *
 * Drops anything the catalogue no longer knows about and back-fills from the
 * defaults, so removing a slot from the catalogue can never strand a user on a
 * blank ring row. When `allowed` is given, the back-fill respects it too and
 * then keeps reaching into the rest of the catalogue — otherwise an estimator,
 * whose defaults include two metrics their role doesn't cover, would land on a
 * half-empty row rather than four rings of things they can actually see.
 *
 * Returns fewer than four only when the catalogue itself offers fewer.
 */
export function resolveKpiSlots(saved: unknown, allowed?: KpiSlotId[]): KpiSlotId[] {
  const permitted = allowed ? new Set<string>(allowed) : VALID_IDS;
  const isPermitted = (id: KpiSlotId) => permitted.has(id);

  const fromSaved = Array.isArray(saved)
    ? (saved.filter(
        (id): id is KpiSlotId => typeof id === "string" && VALID_IDS.has(id) && permitted.has(id)
      ) as KpiSlotId[])
    : [];

  const candidates = [
    ...fromSaved,
    ...DEFAULT_KPI_SLOTS.filter(isPermitted),
    ...KPI_SLOTS.map((slot) => slot.id).filter(isPermitted),
  ];

  const chosen: KpiSlotId[] = [];
  for (const id of candidates) {
    if (chosen.length === RING_SLOT_COUNT) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen;
}

/** Slots this user is allowed to see, given their permission slugs. */
export function availableKpiSlots(permissions: string[]): KpiSlotMeta[] {
  return KPI_SLOTS.filter((slot) => permissions.includes(slot.requires));
}
