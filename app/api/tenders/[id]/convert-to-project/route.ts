import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { auditLog } from "@/lib/audit";
import { toErrorResponse } from "@/lib/api-error";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { loadProjectConfig } from "@/lib/projects/config";

/**
 * "Project awarded" path: converts a Won tender into a Project, carrying over
 * the client, value and expected dates, and seeding one starter ProgramActivity
 * per role in the tender's expectedLabour (full automation chain lands in Phase 10).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("project.edit");
    const db = getTenantContext(session.user.organisationId);

    const tender = await db.tender.findFirst({ where: { id: params.id } });
    if (!tender) throw new NotFoundError("Tender not found");
    if (tender.status !== "Won") {
      throw new BadRequestError('Only a tender with status "Won" can be converted to a project');
    }

    const existingProject = await db.project.findFirst({ where: { sourceTenderId: tender.id } });
    if (existingProject) {
      throw new BadRequestError("This tender has already been converted to a project");
    }

    const config = await loadProjectConfig(session.user.organisationId);
    const startDate = tender.expectedStart ?? new Date();
    const endDate = tender.expectedEnd ?? new Date(startDate.getTime() + 90 * 86_400_000);
    const codeBase = tender.projectName.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "PRJ";

    const project = await db.project.create({
      data: {
        organisationId: session.user.organisationId,
        name: tender.projectName,
        code: `${codeBase}-${tender.id.slice(-4).toUpperCase()}`,
        address: tender.address,
        status: config.statusList[0] ?? "On Track",
        value: tender.value,
        startDate,
        endDate,
        clientId: tender.clientId,
        sourceTenderId: tender.id,
      },
    });

    const expectedLabour = (tender.expectedLabour as Record<string, number> | null) ?? {};
    const roleEntries = Object.entries(expectedLabour).filter(([, count]) => count > 0);
    if (roleEntries.length > 0) {
      await db.programActivity.createMany({
        data: roleEntries.map(([role, count]) => ({
          organisationId: session.user.organisationId,
          projectId: project.id,
          name: `${role} (starter program from tender)`,
          trade: role,
          startDate,
          endDate,
          isCritical: false,
          status: config.activityStatusList[0] ?? "On Track",
          labourRequired: { [role]: count },
        })),
      });
    }

    await auditLog({
      organisationId: session.user.organisationId,
      userId: session.user.id,
      action: "tender.convert_to_project",
      entityType: "Project",
      entityId: project.id,
      after: { name: project.name, code: project.code, sourceTenderId: tender.id },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
