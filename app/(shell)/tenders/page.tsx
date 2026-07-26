import { auth } from "@/lib/auth";
import { getViewMode } from "@/lib/view-mode";
import { DashboardCards } from "@/components/tenders/dashboard-cards";
import { TenderRegisterTable } from "@/components/tenders/tender-register-table";
import { PreConstructionView } from "@/components/tenders/pre-construction-view";

export default async function TendersPage() {
  const session = await auth();
  // Simplified nav labels this route "Pre-Construction" and Full labels it
  // "Tenders" — same route, so the branch happens here rather than forking a
  // second page. Neither DashboardCards nor TenderRegisterTable changes
  // between the two; only how they're arranged does.
  const viewMode = session ? await getViewMode(session.user.organisationId, session.user.id) : "FULL";

  if (viewMode === "SIMPLE") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Pre-Construction</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The tender register and the bid-intelligence behind it, in one place.
          </p>
        </div>
        <PreConstructionView />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <DashboardCards />
      <TenderRegisterTable />
    </div>
  );
}
