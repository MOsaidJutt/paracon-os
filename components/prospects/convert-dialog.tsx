"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/tenders/format";
import type { ProspectRow } from "./types";

/**
 * The one irreversible step in this module, so it says plainly what it will do
 * before it does it.
 *
 * Every line below describes something the existing converter
 * (POST /api/prospects/[id]/convert-to-tender) actually performs — it
 * find-or-creates the Client, find-or-creates the ClientContact, and carries
 * the address and value onto the new Tender. Nothing here is aspirational
 * copy: if the converter stops doing one of these, this list must change too.
 */
export function ConvertProspectDialog({
  prospect,
  onOpenChange,
}: {
  prospect: ProspectRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const convert = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prospects/${id}/convert-to-tender`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't convert this prospect");
      }
      return (await res.json()) as { tender: { id: string; projectName: string } };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success(`Converted to a tender`, {
        description: result.tender.projectName,
        action: {
          label: "Open tender",
          onClick: () => window.location.assign(`/tenders`),
        },
      });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={prospect !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert {prospect?.name} to a tender?</DialogTitle>
          <DialogDescription>
            Everything already on this lead carries across. You won&apos;t retype any of it.
          </DialogDescription>
        </DialogHeader>

        {prospect && (
          <ul className="flex flex-col gap-2 text-sm">
            <Line>
              A client record for <Strong>{prospect.name}</Strong> is created, or matched if one already exists
            </Line>
            {prospect.contactName && (
              <Line>
                <Strong>{prospect.contactName}</Strong> is added as that client&apos;s contact
                {prospect.contactEmail ? ` (${prospect.contactEmail})` : ""}
              </Line>
            )}
            {prospect.address && (
              <Line>
                The address <Strong>{prospect.address}</Strong> carries onto the tender
              </Line>
            )}
            {prospect.estimatedValue != null && (
              <Line>
                The estimate <Strong>{formatCurrency(prospect.estimatedValue)}</Strong> becomes the tender value
              </Line>
            )}
            <Line>This lead moves to Converted and stays linked to the tender it became</Line>
          </ul>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={convert.isPending}>
            Cancel
          </Button>
          <Button onClick={() => prospect && convert.mutate(prospect.id)} disabled={convert.isPending}>
            {convert.isPending ? "Converting..." : "Convert"}
            {!convert.isPending && <ArrowRight className="size-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-rag-green" aria-hidden />
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

