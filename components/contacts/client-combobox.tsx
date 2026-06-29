"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type ClientOption = {
  id: string;
  name: string;
  status: string;
  contacts: { id: string; name: string; email: string | null; phone: string | null }[];
};

/**
 * Type-ahead client picker — "type Buil... Buildcorp pops up" — backed by the
 * shared Contacts database (/api/clients) so every module reads the same
 * list instead of re-typing a client name. cmdk filters the (small,
 * org-sized) list client-side, same pattern as the Allocation worker picker.
 */
export function ClientCombobox({
  id,
  value,
  onChange,
  placeholder = "Select client...",
}: {
  id?: string;
  value: string;
  onChange: (id: string, client: ClientOption | undefined) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", "clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      return (await res.json()) as { clients: ClientOption[] };
    },
  });

  const clients = data?.clients ?? [];
  const selected = clients.find((c) => c.id === value);

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen(true)}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.name : placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search clients..." />
        <CommandList>
          {isLoading && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && <CommandEmpty>No clients found.</CommandEmpty>}
          {clients.map((client) => (
            <CommandItem
              key={client.id}
              value={client.name}
              onSelect={() => {
                onChange(client.id, client);
                setOpen(false);
              }}
              className="justify-between"
            >
              <span className="truncate">{client.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{client.status}</span>
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
