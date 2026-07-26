import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { getPreference, setPreference } from "@/lib/preferences";
import {
  PREFERENCE_DEFAULTS,
  PREFERENCE_SCHEMAS,
  parsePreference,
  preferenceKeySchema,
} from "@/lib/preferences-registry";

/**
 * Generic per-user preference storage. No permission slug: a user always owns
 * their own preferences, and none of them grant anything.
 *
 * Both the key and the value are validated against the registry allowlist, so
 * this can't be used to write arbitrary rows.
 */
export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const session = await requireSession();
    const key = preferenceKeySchema.parse(params.key);

    const stored = await getPreference<unknown>(
      session.user.organisationId,
      session.user.id,
      key,
      (value) => value
    );

    return NextResponse.json({ key, value: stored === null ? PREFERENCE_DEFAULTS[key] : parsePreference(key, stored) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const session = await requireSession();
    const key = preferenceKeySchema.parse(params.key);

    const body = (await req.json()) as { value?: unknown };
    const parsed = PREFERENCE_SCHEMAS[key].safeParse(body?.value);
    if (!parsed.success) throw new BadRequestError(`Invalid value for "${key}"`);

    await setPreference(session.user.organisationId, session.user.id, key, parsed.data);

    return NextResponse.json({ key, value: parsed.data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
