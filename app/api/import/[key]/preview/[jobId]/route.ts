import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { refinePreview } from "@/lib/import/jobs";

const refineBodySchema = z.object({ extra: z.record(z.unknown()).optional() });

/**
 * Re-runs the importer's preview against the file already staged at
 * POST /api/import/[key]/preview, with refined `extra` input (e.g. a chosen
 * column map) — no re-upload. Used by importers like ZZTakeoff where the
 * first preview call can only return headers, not a parsed plan.
 */
export async function POST(req: NextRequest, { params }: { params: { key: string; jobId: string } }) {
  try {
    const session = await requirePermission("import.run");
    const db = getTenantContext(session.user.organisationId);
    const body = refineBodySchema.parse(await req.json());

    const result = await refinePreview(db, session.user.organisationId, session.user.id, params.key, params.jobId, body.extra);
    return NextResponse.json({ importJobId: params.jobId, ...result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
