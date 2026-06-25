"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, FolderKanban, Search, User, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

type SearchResult = {
  type: "project" | "tender" | "worker" | "document";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  preview: Record<string, string>;
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  project: "Projects",
  tender: "Tenders",
  worker: "Workers",
  document: "Documents",
};

const TYPE_ICON: Record<SearchResult["type"], typeof FolderKanban> = {
  project: FolderKanban,
  tender: FileSpreadsheet,
  worker: User,
  document: FileText,
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return { results: [] as SearchResult[] };
      return (await res.json()) as { results: SearchResult[] };
    },
    enabled: open && query.trim().length >= 2,
  });

  const results = data?.results ?? [];
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  function go(result: SearchResult) {
    setOpen(false);
    setQuery("");
    if (result.href.startsWith("/")) {
      router.push(result.href);
    } else {
      window.open(result.href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" onClick={() => setOpen(true)}>
        <Search className="size-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">⌘K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search projects, tenders, workers, documents..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {query.trim().length < 2 && (
              <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
            )}
            {query.trim().length >= 2 && !isFetching && results.length === 0 && (
              <CommandEmpty>No results for &ldquo;{query}&rdquo;.</CommandEmpty>
            )}

            {(Object.keys(grouped) as SearchResult["type"][]).map((type) => {
              const Icon = TYPE_ICON[type];
              return (
                <CommandGroup key={type} heading={TYPE_LABEL[type]}>
                  {grouped[type].map((result) => (
                    <CommandItem key={`${result.type}-${result.id}`} onSelect={() => go(result)} value={`${result.type}-${result.id}`}>
                      <HoverCard openDelay={150}>
                        <HoverCardTrigger asChild>
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-medium text-foreground">{result.title}</span>
                              <span className="truncate text-xs text-muted-foreground">{result.subtitle}</span>
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="right">
                          <p className="mb-2 text-sm font-semibold text-foreground">{result.title}</p>
                          <dl className="flex flex-col gap-1 text-xs">
                            {Object.entries(result.preview).map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">{key}</dt>
                                <dd className="text-right font-medium text-foreground">{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </HoverCardContent>
                      </HoverCard>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
