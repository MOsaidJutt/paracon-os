"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SupplierOption = {
  id: string;
  trade: string;
  company: string;
  kind: string;
  email: string | null;
  phone: string | null;
};

/**
 * Type-ahead supplier/subcontractor picker, backed by the shared Contacts
 * database (/api/suppliers) — one list for PO/delivery/bill forms instead of
 * each form re-fetching its own copy. cmdk filters the list client-side.
 */
export function SupplierCombobox({
  id,
  value,
  onChange,
  placeholder = "Select supplier...",
}: {
  id?: string;
  value: string;
  onChange: (id: string, supplier: SupplierOption | undefined) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", "suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to load suppliers");
      return (await res.json()) as { suppliers: SupplierOption[] };
    },
  });

  const suppliers = data?.suppliers ?? [];
  const selected = suppliers.find((s) => s.id === value);

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen(true)}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.company : placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search suppliers..." />
        <CommandList>
          {isLoading && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && <CommandEmpty>No suppliers found.</CommandEmpty>}
          {suppliers.map((supplier) => (
            <CommandItem
              key={supplier.id}
              value={supplier.company}
              onSelect={() => {
                onChange(supplier.id, supplier);
                setOpen(false);
              }}
              className="justify-between"
            >
              <span className="truncate">{supplier.company}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{supplier.trade}</span>
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
