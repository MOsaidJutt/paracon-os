import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import { toErrorResponse } from "@/lib/api-error";
import { NotFoundError } from "@/lib/errors";

const PAGE_SIZE = 20;

/** Office-side feed: PM/Director view of every foreman daily update on this project, newest first. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("project.view");
    const db = getTenantContext(session.user.organisationId);

    const project = await db.project.findFirst({ where: { id: params.id } });
    if (!project) throw new NotFoundError("Project not found");

    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);

    const [siteUpdates, total] = await Promise.all([
      db.dailySiteUpdate.findMany({
        where: { projectId: params.id },
        orderBy: { date: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          foremanUser: { select: { id: true, name: true } },
          attendance: { include: { worker: { select: { id: true, name: true } } } },
          taskProgress: { include: { programActivity: { select: { id: true, name: true } } } },
          deliveries: { include: { supplier: { select: { id: true, company: true } } } },
          issues: { include: { photos: { select: { id: true, key: true, caption: true } } } },
          photos: { where: { issueId: null }, select: { id: true, key: true, caption: true, tagsJson: true } },
        },
      }),
      db.dailySiteUpdate.count({ where: { projectId: params.id } }),
    ]);

    return NextResponse.json({ siteUpdates, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return toErrorResponse(error);
  }
}
