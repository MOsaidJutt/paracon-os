import { ProjectRegisterTable } from "@/components/projects/project-register-table";

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Project Register</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live and secured projects, their construction program and weekly labour requirement.
        </p>
      </div>
      <ProjectRegisterTable />
    </div>
  );
}
