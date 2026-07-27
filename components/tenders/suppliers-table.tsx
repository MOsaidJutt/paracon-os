"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SupplierFormDialog, type SupplierRow } from "./supplier-form-dialog";

export function SuppliersTable({ onRowClick }: { onRowClick?: (supplier: SupplierRow) => void } = {}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to load suppliers");
      return (await res.json()) as { suppliers: SupplierRow[] };
    },
  });

  const suppliers = (data?.suppliers ?? []).filter((s) => kindFilter === "All" || s.kind === kindFilter);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete supplier");
      }
    },
    onSuccess: () => {
      toast.success("Supplier deleted");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{suppliers.length} of {data?.suppliers.length ?? 0}</p>
          <Tabs value={kindFilter} onValueChange={setKindFilter}>
            <TabsList>
              <TabsTrigger value="All">All</TabsTrigger>
              <TabsTrigger value="Supplier">Suppliers</TabsTrigger>
              <TabsTrigger value="Subcontractor">Subcontractors</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingSupplier(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add supplier
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Trade</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {suppliers.map((supplier) => (
              <TableRow
                key={supplier.id}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={() => onRowClick?.(supplier)}
              >
                <TableCell>
                  <Badge variant={supplier.kind === "Subcontractor" ? "default" : "secondary"}>{supplier.kind}</Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground">{supplier.trade}</TableCell>
                <TableCell>{supplier.company}</TableCell>
                <TableCell className="text-muted-foreground">{supplier.contact ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{supplier.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{supplier.phone ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${supplier.company}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(supplier.id)}>
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

      <SupplierFormDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={editingSupplier} />
    </div>
  );
}
