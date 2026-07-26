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
import { formatCurrency } from "@/lib/tenders/format";
import { ProspectFormDialog, type ProspectRow } from "./prospect-form-dialog";

/**
 * The dense table view of the register.
 *
 * `embedded` drops its own count-and-Add header, because ProspectsView already
 * renders those above whichever view is showing — without it, the List view
 * carried two "Add prospect" buttons stacked on top of each other.
 */
export function ProspectsTable({ embedded = false }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<ProspectRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const res = await fetch("/api/prospects");
      if (!res.ok) throw new Error("Failed to load prospects");
      return (await res.json()) as { prospects: ProspectRow[] };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete prospect");
      }
    },
    onSuccess: () => {
      toast.success("Prospect deleted");
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prospects/${id}/convert-to-tender`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to convert to tender");
      }
    },
    onSuccess: () => {
      toast.success("Converted to a tender — see the Tenders register.");
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-4">
      {!embedded && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{data?.prospects.length ?? 0} prospects</p>
          <Button
            size="sm"
            onClick={() => {
              setEditingProspect(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add prospect
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Est. value</TableHead>
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
            {data?.prospects.map((prospect) => (
              <TableRow key={prospect.id}>
                <TableCell className="font-medium text-foreground">{prospect.name}</TableCell>
                <TableCell className="text-muted-foreground">{prospect.contactName ?? "—"}</TableCell>
                <TableCell>
                  {prospect.convertedTenderId ? (
                    <Badge variant="default">Converted</Badge>
                  ) : (
                    <Badge variant={prospect.stage === "Warm" ? "default" : "secondary"}>{prospect.stage}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatCurrency(prospect.estimatedValue)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${prospect.name}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!prospect.convertedTenderId && (
                        <DropdownMenuItem onClick={() => convertMutation.mutate(prospect.id)}>
                          Convert to Tender
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingProspect(prospect);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(prospect.id)}>
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

      <ProspectFormDialog open={dialogOpen} onOpenChange={setDialogOpen} prospect={editingProspect} />
    </div>
  );
}
