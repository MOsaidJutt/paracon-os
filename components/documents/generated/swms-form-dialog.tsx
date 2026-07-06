"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SwmsHazardLibraryItem } from "@/lib/documents/templates-config";
import type { GeneratedDocumentRow } from "./types";

type CustomHazardLine = {
  activity: string;
  hazard: string;
  riskRating: "Low" | "Medium" | "High";
  controlMeasures: string;
};

type SwmsSnapshotLike = {
  activityDescription: string;
  hazardLines: CustomHazardLine[];
  ppeItems: string[];
  signOffName: string;
  signOffRole: string;
  pmName: string | null;
  siteManagerName: string | null;
};

export function SwmsFormDialog({
  open,
  onOpenChange,
  projectId,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existing?: GeneratedDocumentRow | null;
}) {
  const queryClient = useQueryClient();
  const [activityDescription, setActivityDescription] = useState("");
  const [checkedLibraryIds, setCheckedLibraryIds] = useState<Set<string>>(new Set());
  const [customHazardLines, setCustomHazardLines] = useState<CustomHazardLine[]>([]);
  const [ppeOverride, setPpeOverride] = useState<Set<string> | null>(null);
  const [signOffName, setSignOffName] = useState("");
  const [signOffRole, setSignOffRole] = useState("Site Manager");

  // Enter-once: project/address/client/PM/site manager are all pulled from
  // the project record server-side — this fetch is only to show them here so
  // the PM can see what will auto-fill, never to re-key it.
  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return (await res.json()) as {
        project: { pmUser: { name: string } | null; foremanUser: { name: string } | null };
      };
    },
  });

  const { data: templateData } = useQuery({
    queryKey: ["document-template", "SWMS"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/documents/templates/SWMS");
      if (!res.ok) throw new Error("Failed to load hazard library");
      return (await res.json()) as { configJson: { hazardLibrary: SwmsHazardLibraryItem[]; ppeLibrary: string[] } };
    },
  });

  useEffect(() => {
    if (!open) return;
    const snapshot = existing?.dataSnapshotJson as unknown as SwmsSnapshotLike | undefined;

    if (snapshot) {
      setActivityDescription(snapshot.activityDescription);
      setCustomHazardLines(snapshot.hazardLines);
      setPpeOverride(new Set(snapshot.ppeItems));
      setSignOffName(snapshot.signOffName);
      setSignOffRole(snapshot.signOffRole);
      setCheckedLibraryIds(new Set());
    } else {
      setActivityDescription("");
      setCustomHazardLines([]);
      setPpeOverride(null);
      setSignOffName("");
      setSignOffRole("Site Manager");
      setCheckedLibraryIds(new Set());
    }
  }, [open, existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        activityDescription,
        hazardLibraryItemIds: Array.from(checkedLibraryIds),
        customHazardLines,
        ppeItems: ppeOverride ? Array.from(ppeOverride) : [],
        signOffName,
        signOffRole,
      };
      const url = existing ? `/api/documents/generated/${existing.id}/regenerate` : "/api/documents/generated/swms";
      const body = existing ? payload : { ...payload, projectId };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Failed to generate SWMS");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(existing ? "SWMS regenerated" : "SWMS generated");
      queryClient.invalidateQueries({ queryKey: ["generated-documents", { projectId }] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const hazardLibrary = templateData?.configJson.hazardLibrary ?? [];
  const ppeLibrary = templateData?.configJson.ppeLibrary ?? [];
  const effectivePpe = ppeOverride ?? new Set(ppeLibrary);

  function toggleLibraryItem(id: string) {
    setCheckedLibraryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePpe(item: string) {
    setPpeOverride((current) => {
      const next = new Set(current ?? ppeLibrary);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  const hazardCount = checkedLibraryIds.size + customHazardLines.length;
  const canSubmit = activityDescription.trim() && signOffName.trim() && hazardCount > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{existing ? `Regenerate ${existing.number}` : "Generate SWMS"}</SheetTitle>
          <SheetDescription>
            Project, address, client, PM and site manager are pulled automatically from the project record — nothing
            here is re-typed.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 px-4 py-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Project Manager</span>
              <p className="text-foreground">{projectData?.project.pmUser?.name ?? "Not yet assigned"}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Site Manager</span>
              <p className="text-foreground">{projectData?.project.foremanUser?.name ?? "Not yet assigned"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="swms-activity">Description of works</Label>
            <Textarea
              id="swms-activity"
              rows={3}
              placeholder="e.g. Installation of partition walls, ceiling grid and doors to Level 2 fitout"
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium leading-none text-foreground">Hazard identification & control measures</p>
            {hazardLibrary.map((item) => (
              <label key={item.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
                <Switch checked={checkedLibraryIds.has(item.id)} onCheckedChange={() => toggleLibraryItem(item.id)} />
                <span>
                  <span className="font-medium">
                    {item.activity} — {item.hazard}
                  </span>{" "}
                  <span className="text-muted-foreground">({item.riskRating})</span>
                  <br />
                  <span className="text-xs text-muted-foreground">{item.controlMeasures}</span>
                </span>
              </label>
            ))}

            {customHazardLines.map((line, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Custom hazard ${i + 1} activity`}
                    placeholder="Activity"
                    className="flex-1"
                    value={line.activity}
                    onChange={(e) =>
                      setCustomHazardLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, activity: e.target.value } : l)))
                    }
                  />
                  <Select
                    value={line.riskRating}
                    onValueChange={(riskRating: CustomHazardLine["riskRating"]) =>
                      setCustomHazardLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, riskRating } : l)))
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => setCustomHazardLines((lines) => lines.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Input
                  aria-label={`Custom hazard ${i + 1} description`}
                  placeholder="Hazard"
                  value={line.hazard}
                  onChange={(e) => setCustomHazardLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, hazard: e.target.value } : l)))}
                />
                <Textarea
                  aria-label={`Custom hazard ${i + 1} control measures`}
                  placeholder="Control measures"
                  rows={2}
                  value={line.controlMeasures}
                  onChange={(e) =>
                    setCustomHazardLines((lines) => lines.map((l, idx) => (idx === i ? { ...l, controlMeasures: e.target.value } : l)))
                  }
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setCustomHazardLines((lines) => [...lines, { activity: "", hazard: "", riskRating: "Medium", controlMeasures: "" }])
              }
            >
              <Plus className="size-4" />
              Add custom hazard
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium leading-none text-foreground">Required PPE</p>
            <div className="flex flex-wrap gap-3">
              {ppeLibrary.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm">
                  <Switch checked={effectivePpe.has(item)} onCheckedChange={() => togglePpe(item)} />
                  {item}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="swms-signoff-name">Prepared by (sign-off name)</Label>
              <Input id="swms-signoff-name" value={signOffName} onChange={(e) => setSignOffName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="swms-signoff-role">Role</Label>
              <Input id="swms-signoff-role" value={signOffRole} onChange={(e) => setSignOffRole(e.target.value)} />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Generating..." : existing ? "Regenerate" : "Generate"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
