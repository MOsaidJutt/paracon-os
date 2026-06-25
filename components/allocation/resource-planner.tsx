"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LabourConfig } from "@/lib/labour/config";
import { AllocationGrid } from "./allocation-grid";
import { WorkerPool, type PoolWorker } from "./worker-pool";
import { useAllocationMutations } from "./use-allocation-mutations";

type ProjectOption = { id: string; name: string; code: string };

export function ResourcePlanner() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeWorker, setActiveWorker] = useState<PoolWorker | null>(null);

  // A click-and-drag distance threshold so a plain click on a chip (e.g. to
  // open its hover card) doesn't get mistaken for a drag start.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const {
    data: projectsData,
    isLoading: projectsLoading,
    isError: projectsErrored,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ["allocations", "project-options"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return (await res.json()) as { projects: ProjectOption[] };
    },
  });

  const { data: labourConfig } = useQuery({
    queryKey: ["labour", "config"],
    queryFn: async () => {
      const res = await fetch("/api/labour/config");
      if (!res.ok) throw new Error("Failed to load labour config");
      return (await res.json()) as LabourConfig;
    },
  });

  const projects = projectsData?.projects ?? [];
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const { addMutation } = useAllocationMutations(activeProjectId ?? "");

  function handleDragStart(event: DragStartEvent) {
    setActiveWorker((event.active.data.current?.worker as PoolWorker | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveWorker(null);
    const worker = event.active.data.current?.worker as PoolWorker | undefined;
    const overId = event.over?.id;
    if (!worker || !overId || !activeProjectId) return;

    const [, role, week] = String(overId).split(":");
    if (role !== worker.capability) {
      toast.error(`${worker.name} is a ${worker.capability}, not a ${role} — drop them on a row matching their trade.`);
      return;
    }

    addMutation.mutate({ workerId: worker.id, weekStart: week });
  }

  if (projectsLoading) return <p className="text-sm text-muted-foreground">Loading projects...</p>;
  if (projectsErrored) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
        <p className="text-sm text-destructive">Failed to load projects.</p>
        <Button variant="outline" size="sm" onClick={() => refetchProjects()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!activeProjectId || !activeProject) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No projects yet — create a project before planning resourcing.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveWorker(null)}
    >
      <div className="flex flex-col gap-4">
        <Select value={activeProjectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-72" aria-label="Project">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.code} — {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            <AllocationGrid projectId={activeProjectId} projectName={activeProject.name} />
          </div>
          <WorkerPool tradeOptions={labourConfig?.capabilityList ?? []} />
        </div>
      </div>

      <DragOverlay>
        {activeWorker && (
          <div className="pointer-events-none flex items-center gap-2 rounded-md border border-foreground/30 bg-card px-2 py-1.5 text-sm shadow-lg">
            <Avatar className="size-6">
              <AvatarImage src={activeWorker.photoUrl ?? undefined} alt={activeWorker.name} />
              <AvatarFallback className="text-[10px]">{activeWorker.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-foreground">{activeWorker.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
