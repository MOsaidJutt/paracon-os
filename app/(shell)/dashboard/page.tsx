import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { filterUpcomingMilestones } from "@/lib/projects/calculations";
import { formatDate } from "@/lib/tenders/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_COPY: Record<string, { title: string; description: string }> = {
  director: {
    title: "Command Centre",
    description:
      "Project health, critical dates, labour shortages and capacity will surface here once Phase 5 lands.",
  },
  "project-manager": {
    title: "Program & Labour Overview",
    description:
      "Your programs, weekly labour requirements and allocation gaps will surface here once Phase 3–6 land.",
  },
  estimator: {
    title: "Tender Pipeline",
    description: "The tender register and weighted pipeline KPIs land in Phase 2.",
  },
  viewer: {
    title: "Overview",
    description: "Read-only project visibility lands as later phases ship.",
  },
};

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role ?? "viewer";
  // Zero-tap landing: a foreman's whole job here is the mobile daily update, not a dashboard.
  if (role === "site-foreman") redirect("/site");
  const copy = ROLE_COPY[role] ?? ROLE_COPY.viewer;

  const canViewProjects = session?.user?.permissions.includes("project.view") ?? false;
  const upcomingMilestones = canViewProjects
    ? filterUpcomingMilestones(
        await getTenantContext(session!.user.organisationId).milestone.findMany({
          where: { date: { gte: new Date() } },
          orderBy: { date: "asc" },
          include: { project: { select: { name: true, code: true } } },
        }),
        new Date(),
        30
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </div>

      {canViewProjects && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Critical dates — next 30 days</CardTitle>
            <CardDescription>Auto-derived from critical activities across every project.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical dates in the next 30 days.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {upcomingMilestones.slice(0, 10).map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {m.project.name} <span className="text-muted-foreground">({m.project.code})</span> —{" "}
                      {m.name}
                    </span>
                    <span className="text-muted-foreground">{formatDate(m.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Phase 0 foundation</CardTitle>
          <CardDescription>
            This shell, your role and tenant scoping are live. Build-out for {session?.user?.role}
            -specific views follows the run sequence in the playbook.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{session?.user?.email}</span> at{" "}
          <span className="font-medium text-foreground">{session?.user?.organisationSlug}</span>.
        </CardContent>
      </Card>
    </div>
  );
}
