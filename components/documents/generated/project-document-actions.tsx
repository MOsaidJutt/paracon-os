"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedDocumentsList } from "./generated-documents-list";
import { VariationFormDialog } from "./variation-form-dialog";
import { ProgressClaimFormDialog } from "./progress-claim-form-dialog";
import { SwmsFormDialog } from "./swms-form-dialog";
import type { GeneratedDocumentRow } from "./types";

/** "Generate document" actions + the generated-documents list for a project's Documents tab — Variation, Progress Claim and SWMS. */
export function ProjectDocumentActions({ projectId, canGenerate = true }: { projectId: string; canGenerate?: boolean }) {
  const [variationDialog, setVariationDialog] = useState<{ open: boolean; existing: GeneratedDocumentRow | null }>({
    open: false,
    existing: null,
  });
  const [claimDialog, setClaimDialog] = useState<{ open: boolean; existing: GeneratedDocumentRow | null }>({
    open: false,
    existing: null,
  });
  const [swmsDialog, setSwmsDialog] = useState<{ open: boolean; existing: GeneratedDocumentRow | null }>({
    open: false,
    existing: null,
  });

  function handleRegenerate(doc: GeneratedDocumentRow) {
    if (doc.type === "VARIATION") setVariationDialog({ open: true, existing: doc });
    else if (doc.type === "PROGRESS_CLAIM") setClaimDialog({ open: true, existing: doc });
    else if (doc.type === "SWMS") setSwmsDialog({ open: true, existing: doc });
  }

  return (
    <div className="flex flex-col gap-3">
      {canGenerate && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setVariationDialog({ open: true, existing: null })}>
            <FilePlus2 className="size-4" />
            New Variation
          </Button>
          <Button variant="outline" size="sm" onClick={() => setClaimDialog({ open: true, existing: null })}>
            <FilePlus2 className="size-4" />
            New Progress Claim
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSwmsDialog({ open: true, existing: null })}>
            <FilePlus2 className="size-4" />
            New SWMS
          </Button>
        </div>
      )}

      <GeneratedDocumentsList target={{ projectId }} onRegenerate={canGenerate ? handleRegenerate : undefined} />

      <VariationFormDialog
        open={variationDialog.open}
        onOpenChange={(open) => setVariationDialog((d) => ({ ...d, open }))}
        projectId={projectId}
        existing={variationDialog.existing}
      />
      <ProgressClaimFormDialog
        open={claimDialog.open}
        onOpenChange={(open) => setClaimDialog((d) => ({ ...d, open }))}
        projectId={projectId}
        existing={claimDialog.existing}
      />
      <SwmsFormDialog
        open={swmsDialog.open}
        onOpenChange={(open) => setSwmsDialog((d) => ({ ...d, open }))}
        projectId={projectId}
        existing={swmsDialog.existing}
      />
    </div>
  );
}
