import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ProjectOption = { id: string; name: string; code: string };

export function DashboardFilters({
  projects,
  projectId,
  onProjectChange,
}: {
  projects: ProjectOption[];
  projectId: string | undefined;
  onProjectChange: (projectId: string | undefined) => void;
}) {
  return (
    <Select
      value={projectId ?? "__all__"}
      onValueChange={(value) => onProjectChange(value === "__all__" ? undefined : value)}
    >
      <SelectTrigger className="w-64" aria-label="Project">
        <SelectValue placeholder="All projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All projects</SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name} ({project.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
