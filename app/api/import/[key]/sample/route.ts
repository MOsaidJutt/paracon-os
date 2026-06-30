import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";
import { buildSampleWorkbook } from "@/lib/import/importers/tender-tracker";

const SAMPLE_BUILDERS: Record<string, { fileName: string; build: () => Buffer }> = {
  "tender-tracker": { fileName: "tender-tracker-sample.xlsx", build: buildSampleWorkbook },
};

/** A synthetic, structurally-correct sample file for importers with a fixed shape — never real org data. */
export async function GET(_req: Request, { params }: { params: { key: string } }) {
  try {
    await requirePermission("import.run");
    const entry = SAMPLE_BUILDERS[params.key];
    if (!entry) throw new NotFoundError(`No sample file available for "${params.key}"`);

    return new NextResponse(new Uint8Array(entry.build()), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${entry.fileName}"`,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
