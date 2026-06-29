import Link from "next/link";
import { auth } from "@/lib/auth";
import { StaffScorecardPanel } from "@/components/scorecard/staff-scorecard-panel";

export default async function ScorecardPage() {
  const session = await auth();
  const canAssess = session?.user.permissions.includes("scorecard.assess") ?? false;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/labour" className="text-sm text-muted-foreground hover:text-foreground">
          ← Labour
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Staff Scorecard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monthly performance assessment for key staff — visible to everyone, the seam for a future
          incentive program.
        </p>
      </div>
      <StaffScorecardPanel canAssess={canAssess} />
    </div>
  );
}
