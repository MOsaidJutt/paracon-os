import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { recomputeCompliance } from "@/lib/inngest/functions/recompute-compliance";
import { recomputeForecast } from "@/lib/inngest/functions/recompute-forecast";
import { pollMailbox } from "@/lib/inngest/functions/poll-mailbox";
import { recomputeProductivityJob } from "@/lib/inngest/functions/recompute-productivity";
import { onTenderAwarded } from "@/lib/inngest/functions/on-tender-awarded";
import { onActivityMoved } from "@/lib/inngest/functions/on-activity-moved";
import { onDailyUpdateSubmitted } from "@/lib/inngest/functions/on-daily-update-submitted";
import { onComplianceExpiry } from "@/lib/inngest/functions/on-compliance-expiry";
import { onBillApproved } from "@/lib/inngest/functions/on-bill-approved";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // ─── Scheduled background jobs ─────────────────────────────────────────
    recomputeCompliance,
    recomputeForecast,
    pollMailbox,
    recomputeProductivityJob,
    // ─── Event-driven automations ──────────────────────────────────────────
    onTenderAwarded,        // tender/awarded
    onActivityMoved,        // schedule/activity.moved
    onDailyUpdateSubmitted, // site/daily-update.submitted
    onComplianceExpiry,     // compliance/expiry.alert
    onBillApproved,         // finance/bill.approved
  ],
});
