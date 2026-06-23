import { Badge } from "@/components/ui/badge";

function daysUntil(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / msPerDay);
}

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "Expired") return "destructive";
  if (status === "Expiring") return "secondary";
  return "default";
}

export function ComplianceBadge({ status, expiryDate }: { status: string; expiryDate: string | null }) {
  const days = daysUntil(expiryDate);
  let countdown: string | null = null;
  if (days !== null) {
    if (days < 0) countdown = `${Math.abs(days)}d overdue`;
    else if (days === 0) countdown = "Expires today";
    else countdown = `${days}d left`;
  }

  return (
    <Badge variant={statusVariant(status)} className="gap-1 whitespace-nowrap">
      {status}
      {countdown && <span className="font-normal opacity-80">· {countdown}</span>}
    </Badge>
  );
}
