import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionWithPermissions } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { getPreference, setPreference } from "@/lib/preferences";
import {
  KPI_SLOTS,
  KPI_SLOT_PREFERENCE_KEY,
  RING_SLOT_COUNT,
  availableKpiSlots,
  resolveKpiSlots,
} from "@/lib/dashboard/kpi-slots";

const slotIds = KPI_SLOTS.map((slot) => slot.id) as [string, ...string[]];
const putSchema = z.object({
  // Up to four, not exactly four: a role cleared for fewer metrics than there
  // are ring slots would otherwise be unable to save its rings at all.
  slots: z.array(z.enum(slotIds)).min(1).max(RING_SLOT_COUNT),
});

/** The catalogue this user may choose from, plus the four they currently have. */
export async function GET() {
  try {
    const session = await requireSessionWithPermissions();
    const saved = await getPreference<unknown>(
      session.user.organisationId,
      session.user.id,
      KPI_SLOT_PREFERENCE_KEY,
      (value) => value
    );

    const available = availableKpiSlots(session.user.permissions);

    return NextResponse.json({
      available,
      slots: resolveKpiSlots(
        saved,
        available.map((slot) => slot.id)
      ),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSessionWithPermissions();
    const { slots } = putSchema.parse(await req.json());

    if (new Set(slots).size !== slots.length) {
      throw new BadRequestError("Each ring must show a different metric.");
    }

    // A user can only pin a metric they're allowed to see — otherwise the ring
    // would render empty and, worse, would tell them a metric exists that
    // their role isn't cleared for.
    const allowed = new Set(availableKpiSlots(session.user.permissions).map((slot) => slot.id));
    const forbidden = slots.filter((id) => !allowed.has(id as (typeof KPI_SLOTS)[number]["id"]));
    if (forbidden.length > 0) {
      throw new BadRequestError("One of those metrics isn't available to your role.");
    }

    await setPreference(session.user.organisationId, session.user.id, KPI_SLOT_PREFERENCE_KEY, slots);

    return NextResponse.json({ slots });
  } catch (error) {
    return toErrorResponse(error);
  }
}
