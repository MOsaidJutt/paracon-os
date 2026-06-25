import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/api-error";
import { listImporters } from "@/lib/import/registry";

/** The Import Centre's pluggable importer catalogue. */
export async function GET() {
  try {
    await requirePermission("import.run");
    return NextResponse.json({ importers: listImporters() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
