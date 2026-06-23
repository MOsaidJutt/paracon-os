import { auth } from "@/lib/auth";
import { SkillsMatrixGrid } from "@/components/labour/skills-matrix-grid";
import { RecomputeComplianceButton } from "@/components/labour/recompute-compliance-button";

export default async function LabourPage() {
  const session = await auth();
  const canManageCompliance = session?.user.permissions.includes("compliance.manage") ?? false;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Skills Matrix</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Worker capability, skills and compliance status at a glance.
          </p>
        </div>
        {canManageCompliance && <RecomputeComplianceButton />}
      </div>
      <SkillsMatrixGrid />
    </div>
  );
}
