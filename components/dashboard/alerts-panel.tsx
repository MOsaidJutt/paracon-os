import Link from "next/link";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Alert } from "@/lib/dashboard/alerts";

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alerts</CardTitle>
        <CardDescription>Labour shortages and expiring compliance, worst first.</CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active alerts.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Link
                  href={alert.href}
                  className="flex items-start gap-2.5 rounded-md border border-border p-2.5 text-sm transition-colors hover:bg-muted/60"
                >
                  {alert.severity === "red" ? (
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rag-red" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rag-amber" />
                  )}
                  <span>
                    <span className="font-medium text-foreground">{alert.title}</span>
                    <span className="block text-muted-foreground">{alert.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
