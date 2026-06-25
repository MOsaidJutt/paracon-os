import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { defaultDocumentTemplateConfig } from "@/lib/documents/templates-config";

const TYPES = ["TENDER_LETTER", "VARIATION", "PROGRESS_CLAIM"] as const;

/** All 3 document templates' generation config (scope-builder library, qualifications boilerplate, PDF colours) — CONFIG NOT CODE, editable here instead of in the generators. */
export async function GET() {
  try {
    const session = await requirePermission("admin.settings");
    const db = getTenantContext(session.user.organisationId);

    const rows = await db.documentTemplate.findMany({ where: { type: { in: [...TYPES] } } });
    const byType = new Map(rows.map((r) => [r.type, r]));

    const templates = TYPES.map((type) => {
      const row = byType.get(type);
      return {
        type,
        configJson: row?.configJson ?? defaultDocumentTemplateConfig(type),
        isActive: row?.isActive ?? true,
        isCustomised: !!row,
      };
    });

    return NextResponse.json({ templates });
  } catch (error) {
    return toErrorResponse(error);
  }
}
