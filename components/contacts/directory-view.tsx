"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientsTable, type ApiClientRow } from "@/components/tenders/clients-table";
import { ClientFormDialog, type ClientRow } from "@/components/tenders/client-form-dialog";
import { SuppliersTable } from "@/components/tenders/suppliers-table";
import { SupplierFormDialog, type SupplierRow } from "@/components/tenders/supplier-form-dialog";
import { SkillsMatrixGrid } from "@/components/labour/skills-matrix-grid";

/**
 * Directory: one database of clients, suppliers/subbies and workers
 * (FEEDBACK_NOTES §5), reached from a single screen instead of three routes.
 *
 * ClientsTable, SuppliersTable and SkillsMatrixGrid are reused exactly as
 * Full renders them — same columns, same CRUD, same data. The only addition
 * is an optional onRowClick each table now accepts (unused by Full's own
 * callers, so Full is byte-for-byte unchanged): clicking a row here opens
 * the same edit dialog "..." already opens, as the detail view — a second,
 * quicker way into content that already exists rather than a new screen.
 * Workers already navigate to the existing full /labour/[id] profile on
 * row click (SkillsMatrixGrid's own long-standing behaviour) — its six tabs
 * of compliance uploads and allocation grids don't fit a side panel, so that
 * full page stays the "detail view" for workers rather than being folded in.
 */
export function DirectoryView() {
  const [tab, setTab] = useState<"clients" | "suppliers" | "workers">("clients");

  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  function openClient(client: ApiClientRow) {
    setEditingClient(client);
    setClientDialogOpen(true);
  }

  function openSupplier(supplier: SupplierRow) {
    setEditingSupplier(supplier);
    setSupplierDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers &amp; Subbies</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <ClientsTable onRowClick={openClient} />
        </TabsContent>

        <TabsContent value="suppliers">
          <SuppliersTable onRowClick={openSupplier} />
        </TabsContent>

        <TabsContent value="workers">
          <SkillsMatrixGrid />
        </TabsContent>
      </Tabs>

      <ClientFormDialog open={clientDialogOpen} onOpenChange={setClientDialogOpen} client={editingClient} />
      <SupplierFormDialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen} supplier={editingSupplier} />
    </div>
  );
}
