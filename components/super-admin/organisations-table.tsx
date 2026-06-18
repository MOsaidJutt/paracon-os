"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateOrganisationDialog } from "./create-organisation-dialog";

type OrganisationRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  _count: { users: number };
};

export function OrganisationsTable() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin", "organisations"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/organisations");
      if (!res.ok) throw new Error("Failed to load organisations");
      return (await res.json()) as { organisations: OrganisationRow[] };
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.organisations.length ?? 0} organisation{data?.organisations.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Create organisation
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Status</TableHead>
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
            {data?.organisations.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium text-foreground">{org.name}</TableCell>
                <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                <TableCell className="text-muted-foreground">{org._count.users}</TableCell>
                <TableCell>
                  <Badge variant={org.isActive ? "outline" : "secondary"}>
                    {org.isActive ? "Active" : "Suspended"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/super-admin/organisations/${org.id}`}>Manage</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateOrganisationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
