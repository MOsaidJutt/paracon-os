import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError } from "@/lib/errors";
import { getImporter } from "@/lib/import/registry";
import { IMPORT_MAX_BYTES, stageImport } from "@/lib/import/jobs";

function parseExtraField(raw: FormDataEntryValue | null): Record<string, unknown> | undefined {
  if (raw === null) return undefined;
  if (typeof raw !== "string") throw new BadRequestError("extra must be a JSON string");
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new BadRequestError("extra must be valid JSON");
  }
}

/** First step of every importer's upload → column-map → preview → commit flow — stages the file and runs its initial preview. */
export async function POST(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const session = await requirePermission("import.run");
    const db = getTenantContext(session.user.organisationId);
    getImporter(params.key); // 404s early on an unknown importer key

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > IMPORT_MAX_BYTES) {
      return NextResponse.json({ error: "File is too large" }, { status: 400 });
    }
    const extra = parseExtraField(formData.get("extra"));

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await stageImport(db, session.user.organisationId, session.user.id, params.key, file.name, buffer, extra);

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
