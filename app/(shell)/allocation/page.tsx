import { ResourcePlanner } from "@/components/allocation/resource-planner";

export default function AllocationPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Resource Planner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag workers onto a project&apos;s weeks — allocated vs required, by trade and block.
        </p>
      </div>
      <ResourcePlanner />
    </div>
  );
}
