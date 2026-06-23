"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Skill = { id: string; name: string };

export function SkillEditor({
  workerId,
  initialLevels,
}: {
  workerId: string;
  initialLevels: Record<string, number>;
}) {
  const queryClient = useQueryClient();
  const [levels, setLevels] = useState<Record<string, number>>(initialLevels);
  const [newSkillName, setNewSkillName] = useState("");

  const { data } = useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const res = await fetch("/api/skills");
      if (!res.ok) throw new Error("Failed to load skills");
      return (await res.json()) as { skills: Skill[] };
    },
  });

  const addSkillMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add skill");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewSkillName("");
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const skills = Object.entries(levels)
        .filter(([, level]) => level > 0)
        .map(([skillId, level]) => ({ skillId, level }));
      const res = await fetch(`/api/workers/${workerId}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Skills updated");
      queryClient.invalidateQueries({ queryKey: ["labour"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const skills = data?.skills ?? [];

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <h3 className="text-sm font-semibold text-foreground">Skills</h3>

        {skills.map((skill) => (
          <div key={skill.id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">{skill.name}</span>
            <Select
              value={String(levels[skill.id] ?? 0)}
              onValueChange={(value) => setLevels((prev) => ({ ...prev, [skill.id]: Number(value) }))}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Not set</SelectItem>
                {[1, 2, 3, 4, 5].map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Input
            placeholder="New skill name"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            className="h-8"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!newSkillName.trim() || addSkillMutation.isPending}
            onClick={() => addSkillMutation.mutate(newSkillName.trim())}
          >
            <Plus className="size-4" />
            Add skill
          </Button>
        </div>

        <Button size="sm" className="self-start" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save skills"}
        </Button>
      </CardContent>
    </Card>
  );
}
