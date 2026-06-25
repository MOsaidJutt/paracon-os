import { auth } from "@/lib/auth";
import { ProductivityTrends } from "@/components/labour/productivity-trends";
import { RecomputeProductivityButton } from "@/components/labour/recompute-productivity-button";

export default async function ProductivityPage() {
  const session = await auth();
  const canRecompute = session?.user.permissions.includes("worker.edit") ?? false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Productivity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planned vs actual labour hours by trade, derived from daily updates and allocations —
            feeds the historical $/hour benchmark back into estimating.
          </p>
        </div>
        {canRecompute && <RecomputeProductivityButton />}
      </div>
      <ProductivityTrends />
    </div>
  );
}
