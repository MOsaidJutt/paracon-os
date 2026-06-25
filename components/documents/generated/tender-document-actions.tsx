"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedDocumentsList } from "./generated-documents-list";
import { TenderLetterFormDialog } from "./tender-letter-form-dialog";
import type { GeneratedDocumentRow } from "./types";

/** "Generate Tender Letter" action + the generated-documents list for a tender's Documents panel. */
export function TenderDocumentActions({ tenderId, canGenerate = true }: { tenderId: string; canGenerate?: boolean }) {
  const [dialog, setDialog] = useState<{ open: boolean; existing: GeneratedDocumentRow | null }>({ open: false, existing: null });

  return (
    <div className="flex flex-col gap-3">
      {canGenerate && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialog({ open: true, existing: null })}>
            <FilePlus2 className="size-4" />
            New Tender Letter
          </Button>
        </div>
      )}

      <GeneratedDocumentsList
        target={{ tenderId }}
        onRegenerate={canGenerate ? (doc) => setDialog({ open: true, existing: doc }) : undefined}
      />

      <TenderLetterFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        tenderId={tenderId}
        existing={dialog.existing}
      />
    </div>
  );
}
