"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type BaselineOption = { id: string; name: string };

/** The Gantt's consolidated display-options menu (eye icon) — Critical Path, Baseline overlay, and a critical-only filter live together here. */
export function GanttViewMenu({
  showCriticalPath,
  onShowCriticalPathChange,
  criticalOnly,
  onCriticalOnlyChange,
  baselines,
  selectedBaselineId,
  onSelectedBaselineIdChange,
  showBaseline,
  onShowBaselineChange,
}: {
  showCriticalPath: boolean;
  onShowCriticalPathChange: (value: boolean) => void;
  criticalOnly: boolean;
  onCriticalOnlyChange: (value: boolean) => void;
  baselines: BaselineOption[];
  selectedBaselineId: string | null;
  onSelectedBaselineIdChange: (id: string | null) => void;
  showBaseline: boolean;
  onShowBaselineChange: (value: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="size-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <DropdownMenuLabel className="px-0 text-xs uppercase tracking-wide text-muted-foreground">
          Display
        </DropdownMenuLabel>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-foreground">Critical path</span>
          <Switch checked={showCriticalPath} onCheckedChange={onShowCriticalPathChange} />
        </div>

        {showCriticalPath && (
          <div className="mt-2 flex items-center justify-between pl-2">
            <span className="text-xs text-muted-foreground">Show only critical tasks</span>
            <Switch checked={criticalOnly} onCheckedChange={onCriticalOnlyChange} />
          </div>
        )}

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Baseline</span>
          <Switch checked={showBaseline} onCheckedChange={onShowBaselineChange} disabled={baselines.length === 0} />
        </div>

        {showBaseline && baselines.length > 0 && (
          <div className="mt-2">
            <Select value={selectedBaselineId ?? undefined} onValueChange={onSelectedBaselineIdChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select a baseline" />
              </SelectTrigger>
              <SelectContent>
                {baselines.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {baselines.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">No baselines saved yet.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
