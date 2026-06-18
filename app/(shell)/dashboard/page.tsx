import { auth } from "@/lib/auth";
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
  "site-foreman": {
    title: "Today on Site",
    description: "Your daily update flow (attendance, tasks, deliveries, issues) lands in Phase 7.",
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
  const copy = ROLE_COPY[role] ?? ROLE_COPY.viewer;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </div>

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
