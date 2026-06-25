"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CrewChecklist } from "./crew-checklist";
import { TaskChecklist } from "./task-checklist";
import { DeliveryChecklist } from "./delivery-checklist";
import { PhotoCapture } from "./photo-capture";
import { IssueForm } from "./issue-form";
import { SyncStatusBadge } from "./sync-status-badge";
import { enqueueSubmit } from "@/lib/offline/sync-queue";

type TodayResponse = {
  project: { id: string; name: string; code: string; address: string | null } | null;
  date: string;
  activities: { id: string; name: string; trade: string; status: string }[];
  deliveries: {
    id: string;
    status: string;
    itemsJson: { description: string }[];
    supplier: { id: string; company: string } | null;
  }[];
  workers: { id: string; name: string; capability: string }[];
  suggestedAttendance: { workerId: string; present: boolean }[];
  existingUpdate: {
    note: string | null;
    submittedAt: string | null;
    attendance: { workerId: string; present: boolean }[];
    taskProgress: { programActivityId: string; status: string }[];
  } | null;
  config: {
    issueSeverityList: string[];
    issueStatusList: string[];
    photoTagList: string[];
    activityStatusList: string[];
    deliveryStatusList: string[];
  };
};

/** Local-calendar "today" — a foreman's day boundary is their own clock, not the server's UTC day. */
function localDateString(d = new Date()): string {
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function SiteDailyUpdate() {
  const [date] = useState(() => localDateString());
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["site", "today", date],
    queryFn: async () => {
      const res = await fetch(`/api/site/today?date=${date}`);
      if (!res.ok) throw new Error("Failed to load today's update");
      return (await res.json()) as TodayResponse;
    },
  });

  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [taskStatus, setTaskStatus] = useState<Record<string, string>>({});
  const [deliveryStatus, setDeliveryStatus] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    if (data.existingUpdate) {
      setAttendance(Object.fromEntries(data.existingUpdate.attendance.map((a) => [a.workerId, a.present])));
      setTaskStatus(Object.fromEntries(data.existingUpdate.taskProgress.map((t) => [t.programActivityId, t.status])));
      setNote(data.existingUpdate.note ?? "");
    } else {
      setAttendance(Object.fromEntries(data.suggestedAttendance.map((a) => [a.workerId, a.present])));
    }
    setHydrated(true);
  }, [data, hydrated]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading today&apos;s update...</p>;

  if (!data?.project) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>No project assigned</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ask your Director or Project Manager to assign you to a project before you can submit a daily update.
        </CardContent>
      </Card>
    );
  }

  const project = data.project;
  const canSubmit = Object.keys(attendance).length > 0 && (Object.keys(taskStatus).length > 0 || note.trim().length > 0);

  async function handleSubmit() {
    await enqueueSubmit({
      projectId: project.id,
      date,
      note: note.trim() || null,
      attendance: Object.entries(attendance).map(([workerId, present]) => ({ workerId, present })),
      taskProgress: Object.entries(taskStatus).map(([programActivityId, status]) => ({ programActivityId, status })),
      deliveryConfirmations: Object.entries(deliveryStatus).map(([deliveryId, status]) => ({ deliveryId, status })),
    });
    setJustSaved(true);
    void queryClient.invalidateQueries({ queryKey: ["site", "today", date] });
  }

  function refreshToday() {
    void queryClient.invalidateQueries({ queryKey: ["site", "today", date] });
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.code} &middot; {date}
          </p>
        </div>
        <SyncStatusBadge />
      </div>

      {data.existingUpdate?.submittedAt && (
        <p className="text-xs text-muted-foreground">Already saved today — you can still update it.</p>
      )}

      <CrewChecklist
        allWorkers={data.workers}
        attendance={attendance}
        onToggle={(workerId) => setAttendance((a) => ({ ...a, [workerId]: !a[workerId] }))}
        onAdd={(workerId) => setAttendance((a) => ({ ...a, [workerId]: true }))}
      />

      <TaskChecklist
        activities={data.activities}
        statusList={data.config.activityStatusList}
        taskStatus={taskStatus}
        onSetStatus={(activityId, status) => setTaskStatus((t) => ({ ...t, [activityId]: status }))}
      />

      <DeliveryChecklist
        deliveries={data.deliveries}
        statusList={data.config.deliveryStatusList}
        deliveryStatus={deliveryStatus}
        onSetStatus={(deliveryId, status) => setDeliveryStatus((d) => ({ ...d, [deliveryId]: status }))}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {photoPreviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="Site photo" className="h-16 w-16 rounded-md object-cover" />
              ))}
            </div>
          )}
          <PhotoCapture
            projectId={project.id}
            date={date}
            tag="Progress"
            onCaptured={(_tempId, previewUrl) => setPhotoPreviews((p) => [...p, previewUrl])}
          />
        </CardContent>
      </Card>

      <IssueForm projectId={project.id} date={date} severityList={data.config.issueSeverityList} onSent={refreshToday} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Note</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Weather, access issues, anything else..."
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setJustSaved(false);
            }}
            className="min-h-20 text-base"
          />
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4">
        <Button type="button" className="h-14 w-full text-base font-semibold" disabled={!canSubmit} onClick={handleSubmit}>
          {justSaved ? "Saved — will sync" : "Save daily update"}
        </Button>
        {!canSubmit && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Add crew and tick at least one task (or add a note) to save.
          </p>
        )}
      </div>
    </div>
  );
}
