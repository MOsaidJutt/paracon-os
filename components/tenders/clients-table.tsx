"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientFormDialog, type ClientRow } from "./client-form-dialog";

export type ApiClientRow = ClientRow & { _count: { tenders: number } };

export function ClientsTable({ onRowClick }: { onRowClick?: (client: ApiClientRow) => void } = {}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      return (await res.json()) as { clients: ApiClientRow[] };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete client");
      }
    },
    onSuccess: () => {
      toast.success("Client deleted");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.clients.length ?? 0} clients</p>
        <Button
          size="sm"
          onClick={() => {
            setEditingClient(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add client
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Tenders</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {data?.clients.map((client) => (
              <TableRow
                key={client.id}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={() => onRowClick?.(client)}
              >
                <TableCell className="font-medium text-foreground">{client.name}</TableCell>
                <TableCell>
                  <Badge variant={client.status === "Pause" ? "secondary" : "default"}>{client.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{client.contacts.length}</TableCell>
                <TableCell className="text-muted-foreground">{client._count.tenders}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${client.name}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingClient(client);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        disabled={client._count.tenders > 0}
                        onClick={() => deleteMutation.mutate(client.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ClientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} client={editingClient} />
    </div>
  );
}
