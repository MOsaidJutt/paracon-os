import { ForecastDashboard } from "@/components/forecast/forecast-dashboard";

export default function ForecastPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Forecast & Capacity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Labour demand vs availability, by trade and block — can we take on more work?
        </p>
      </div>
      <ForecastDashboard />
    </div>
  );
}
