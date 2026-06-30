import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";
import { nextCounterValue, formatDocumentNumber } from "@/lib/documents/numbering";
import { addDays } from "@/lib/dates";
import { auditLog } from "@/lib/audit";

/** Shape of one task in the `automation.ganttTemplate` Config list. */
export type GanttTemplateTask = {
  name: string;
  trade: string;
  durationDays: number;
  orderIndex: number;
  isMilestone?: boolean;
  milestoneType?: string;
};

const PROJECT_CODE_SCOPE = "AUTOMATION:PROJECT_CODE";

async function nextProjectCode(organisationId: string): Promise<string> {
  const [prefix, padding, seq] = await Promise.all([
    getConfig<string>("automation.projectCodePrefix", organisationId),
    getConfig<number>("automation.projectCodePadding", organisationId),
    nextCounterValue(organisationId, PROJECT_CODE_SCOPE),
  ]);
  return formatDocumentNumber(prefix, padding, seq);
}

/**
 * Creates a Project from the given Tender (if not already converted) and seeds it
 * with ProgramActivity rows from the `automation.ganttTemplate` Config.
 *
 * Returns the project id on success, null when the tender is missing required
 * date fields or the tender was not found.
 *
 * Idempotent: returns the existing project id when the tender was already converted.
 */
export async function autoCreateProjectFromTender(
  tenderId: string,
  organisationId: string
): Promise<string | null> {
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, organisationId },
    include: { project: { select: { id: true } } },
  });

  if (!tender) return null;
  // Already converted — idempotent.
  if (tender.project) return tender.project.id;

  if (!tender.expectedStart || !tender.expectedEnd) {
    console.warn(
      `[automation:project-setup] Tender ${tenderId} has no expectedStart/expectedEnd — skipping auto-create`
    );
    return null;
  }

  const [code, template] = await Promise.all([
    nextProjectCode(organisationId),
    getConfig<GanttTemplateTask[]>("automation.ganttTemplate", organisationId),
  ]);

  // Create project + activities atomically.
  const project = await prisma.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: {
        organisationId,
        name: tender.projectName,
        code,
        address: tender.address ?? null,
        status: "On Track",
        value: tender.value,
        startDate: tender.expectedStart as Date,
        endDate: tender.expectedEnd as Date,
        clientId: tender.clientId,
        sourceTenderId: tender.id,
        tradePackages: (tender.tradePackages ?? null) as object,
      },
    });

    if (template.length > 0) {
      // Chain activities sequentially from project start date.
      let cursor = tender.expectedStart as Date;
      const rows = template.map((task) => {
        const startDate = new Date(cursor);
        const endDate = addDays(cursor, Math.max(0, task.durationDays - 1));
        cursor = addDays(cursor, task.durationDays);
        return {
          organisationId,
          projectId: proj.id,
          name: task.name,
          trade: task.trade,
          startDate,
          endDate,
          orderIndex: task.orderIndex,
          isMilestone: task.isMilestone ?? false,
          milestoneType: task.milestoneType ?? null,
          status: "On Track",
          labourRequired: {} as object,
        };
      });
      await tx.programActivity.createMany({ data: rows });
    }

    return proj;
  });

  await auditLog({
    organisationId,
    action: "automation.project_auto_created",
    entityType: "Project",
    entityId: project.id,
    after: {
      name: project.name,
      code: project.code,
      sourceTenderId: tenderId,
      activitiesSeeded: template.length,
    },
  });

  return project.id;
}
