import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toErrorResponse } from "@/lib/api-error";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("admin.ai");
    const { searchParams } = new URL(req.url);
    const feature = searchParams.get("feature") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

    const where = {
      organisationId: session.user.organisationId,
      ...(feature ? { feature } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.aiUsageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.aiUsageLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return toErrorResponse(error);
  }
}
