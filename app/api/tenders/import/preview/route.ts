import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { loadTenderConfig } from "@/lib/tenders/config";
import { buildImportPlan } from "@/lib/tenders/import";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function dateOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("tender.edit");
    const db = getTenantContext(session.user.organisationId);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const config = await loadTenderConfig(session.user.organisationId);
    const plan = await buildImportPlan(buffer, db, config);

    return NextResponse.json({
      clients: plan.clients,
      suppliers: plan.suppliers,
      tenders: plan.tenders.map((t) => ({ ...t, received: dateOrNull(t.received), due: dateOrNull(t.due), submitted: dateOrNull(t.submitted) })),
      configWarnings: plan.configWarnings,
      summary: {
        clients: { create: plan.clients.filter((c) => c.action === "create").length, update: plan.clients.filter((c) => c.action === "update").length },
        suppliers: { create: plan.suppliers.filter((s) => s.action === "create").length, update: plan.suppliers.filter((s) => s.action === "update").length },
        tenders: {
          create: plan.tenders.filter((t) => t.action === "create").length,
          update: plan.tenders.filter((t) => t.action === "update").length,
          skip: plan.tenders.filter((t) => t.action === "skip").length,
        },
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
