"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Activity = { id: string; name: string; trade: string };

export function TaskChecklist({
  activities,
  statusList,
  taskStatus,
  onSetStatus,
}: {
  activities: Activity[];
  statusList: string[];
  taskStatus: Record<string, string>;
  onSetStatus: (activityId: string, status: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Today&apos;s tasks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {activities.length === 0 && <p className="text-sm text-muted-foreground">No active program activity today.</p>}
        {activities.map((activity) => (
          <div key={activity.id} className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-foreground">
              {activity.name} <span className="font-normal text-muted-foreground">({activity.trade})</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {statusList.map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={taskStatus[activity.id] === status ? "default" : "outline"}
                  className="h-12 flex-1 min-w-[90px] text-sm"
                  onClick={() => onSetStatus(activity.id, status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
