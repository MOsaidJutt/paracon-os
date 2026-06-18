import { DashboardCards } from "@/components/tenders/dashboard-cards";
import { TenderRegisterTable } from "@/components/tenders/tender-register-table";

export default function TendersPage() {
  return (
    <div className="flex flex-col gap-8">
      <DashboardCards />
      <TenderRegisterTable />
    </div>
  );
}
