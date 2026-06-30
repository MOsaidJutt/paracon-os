"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkerFormSheet, type WorkerRow } from "./worker-form-sheet";
import { WorkerPhotoUpload } from "./worker-photo-upload";
import { PerformanceRadar, type PerformanceScores } from "./performance-radar";
import { PerformanceEditor } from "./performance-editor";
import { ComplianceList, type ComplianceRow } from "./compliance-list";
import { SkillEditor } from "./skill-editor";
import { ComplianceBadge } from "./compliance-badge";
import { AvailabilityCalendar } from "./availability-calendar";
import { WorkerAllocations } from "./worker-allocations";
import { AuditTrail } from "@/components/audit/audit-trail";

type ApiWorker = WorkerRow & {
  photoUrl: string | null;
  performance: PerformanceScores | null;
  compliance: ComplianceRow[];
  skills: { skillId: string; level: number; skill: { id: string; name: string } }[];
};

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Available") return "default";
  if (status === "Assigned") return "secondary";
  return "outline";
}

function ComingSoon({ label }: { label: string }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Coming in a later phase.</CardContent>
    </Card>
  );
}

export function WorkerProfile({ workerId }: { workerId: string }) {
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["labour", "worker", workerId],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${workerId}`);
      if (!res.ok) throw new Error("Failed to load worker");
      return (await res.json()) as { worker: ApiWorker };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading worker...</p>;

  const worker = data.worker;
  const worstCompliance = worker.compliance.reduce<string>((worst, c) => {
    const severity: Record<string, number> = { Valid: 0, Expiring: 1, Expired: 2 };
    return (severity[c.status] ?? 0) > (severity[worst] ?? 0) ? c.status : worst;
  }, "Valid");
  const skillLevels = Object.fromEntries(worker.skills.map((s) => [s.skillId, s.level]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <WorkerPhotoUpload workerId={worker.id} name={worker.name} photoUrl={worker.photoUrl} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{worker.name}</h1>
              <Badge variant={statusVariant(worker.status)}>{worker.status}</Badge>
              <ComplianceBadge status={worstCompliance} expiryDate={null} />
              {worker.isKeyStaff && <Badge variant="outline">Key staff</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {worker.capability} &middot; {worker.employmentType}
              {worker.baseLocation ? ` · ${worker.baseLocation}` : ""}
              {worker.phone ? ` · ${worker.phone}` : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditSheetOpen(true)}>
          <Pencil className="size-4" />
          Edit worker
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="allocation">Allocation</TabsTrigger>
          <TabsTrigger value="history">Site History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 sm:grid-cols-2">
          {worker.isKeyStaff ? (
            <Card className="sm:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="size-4 text-muted-foreground" />
                  Tracked in the Staff Scorecard
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  As key staff, {worker.name}&apos;s Quality, Reliability, Productivity and Safety are
                  assessed monthly on the Staff Scorecard, not here, so there&apos;s one place to set them.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/scorecard">Open Scorecard</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <PerformanceRadar
                    scores={
                      worker.performance ?? { quality: 0, reliability: 0, productivity: 0, safety: 0 }
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Update scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <PerformanceEditor
                    workerId={worker.id}
                    initial={worker.performance ?? { quality: 0, reliability: 0, productivity: 0, safety: 0 }}
                  />
                </CardContent>
              </Card>
            </>
          )}

          <div className="sm:col-span-2">
            <AuditTrail entityType="Worker" entityId={worker.id} />
          </div>
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceList workerId={worker.id} compliance={worker.compliance} />
        </TabsContent>

        <TabsContent value="skills">
          <SkillEditor workerId={worker.id} initialLevels={skillLevels} />
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityCalendar workerId={worker.id} />
        </TabsContent>

        <TabsContent value="allocation">
          <WorkerAllocations workerId={worker.id} />
        </TabsContent>

        <TabsContent value="history">
          <ComingSoon label="Site history" />
        </TabsContent>
      </Tabs>

      <WorkerFormSheet open={editSheetOpen} onOpenChange={setEditSheetOpen} worker={worker} />
    </div>
  );
}
