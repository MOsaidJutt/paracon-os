"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkerOption = { id: string; name: string; capability: string };

export function CrewChecklist({
  allWorkers,
  attendance,
  onToggle,
  onAdd,
}: {
  allWorkers: WorkerOption[];
  attendance: Record<string, boolean>;
  onToggle: (workerId: string) => void;
  onAdd: (workerId: string) => void;
}) {
  const workerById = new Map(allWorkers.map((w) => [w.id, w]));
  const shownIds = Object.keys(attendance);
  const addableWorkers = allWorkers.filter((w) => !attendance[w.id] && !shownIds.includes(w.id));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Crew today</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {shownIds.length === 0 && <p className="text-sm text-muted-foreground">No crew yet — add someone below.</p>}
        {shownIds.map((workerId) => {
          const worker = workerById.get(workerId);
          const present = attendance[workerId];
          return (
            <Button
              key={workerId}
              type="button"
              variant={present ? "default" : "outline"}
              className="h-12 w-full justify-between px-4 text-base"
              onClick={() => onToggle(workerId)}
            >
              <span>{worker?.name ?? "Unknown worker"}</span>
              <span className="text-sm font-normal">{present ? "Present" : "Absent"}</span>
            </Button>
          );
        })}

        {addableWorkers.length > 0 && (
          <Select onValueChange={(value) => onAdd(value)} value="">
            <SelectTrigger className="h-12">
              <SelectValue placeholder="+ Add crew member" />
            </SelectTrigger>
            <SelectContent>
              {addableWorkers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name} ({w.capability})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}
