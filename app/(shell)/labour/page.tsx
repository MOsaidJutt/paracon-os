import Link from "next/link";
import { auth } from "@/lib/auth";
import { SkillsMatrixGrid } from "@/components/labour/skills-matrix-grid";
import { RecomputeComplianceButton } from "@/components/labour/recompute-compliance-button";
import { Button } from "@/components/ui/button";

export default async function LabourPage() {
  const session = await auth();
  const canManageCompliance = session?.user.permissions.includes("compliance.manage") ?? false;
  const canViewScorecard = session?.user.permissions.includes("scorecard.view") ?? false;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Skills Matrix</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Worker capability, skills and compliance status at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canViewScorecard && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/scorecard">Scorecard</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/labour/productivity">Productivity</Link>
          </Button>
          {canManageCompliance && <RecomputeComplianceButton />}
        </div>
      </div>
      <SkillsMatrixGrid />
    </div>
  );
}
