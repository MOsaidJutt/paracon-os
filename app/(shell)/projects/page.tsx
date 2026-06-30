import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ProjectRegisterTable } from "@/components/projects/project-register-table";

export default async function ProjectsPage() {
  const session = await auth();
  const canEditTemplates = session?.user.permissions.includes("doc.edit") ?? false;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Project Register</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live and secured projects, their construction program and weekly labour requirement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects/schedule">Schedule calendar</Link>
          </Button>
          {canEditTemplates && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects/templates">Templates</Link>
            </Button>
          )}
        </div>
      </div>
      <ProjectRegisterTable />
    </div>
  );
}
