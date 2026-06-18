"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PendingInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  role: { id: string; name: string };
};

export function PendingInvites() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: async () => {
      const res = await fetch("/api/admin/invites");
      if (!res.ok) throw new Error("Failed to load invites");
      return (await res.json()) as { invites: PendingInvite[] };
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to cancel invite");
    },
    onSuccess: () => {
      toast.success("Invite cancelled");
      queryClient.invalidateQueries({ queryKey: ["admin", "invites"] });
    },
    onError: () => toast.error("Failed to cancel invite"),
  });

  if (isLoading || !data || data.invites.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pending invites</CardTitle>
        <CardDescription>Not yet accepted — cancel to free up the role or resend by re-inviting.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {data.invites.map((invite) => {
          const expired = new Date(invite.expiresAt) < new Date();
          return (
            <div key={invite.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{invite.email}</span>
                <span className="text-xs text-muted-foreground">{invite.role.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={expired ? "secondary" : "outline"}>{expired ? "Expired" : "Pending"}</Badge>
                <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(invite.id)}>
                  Cancel
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
