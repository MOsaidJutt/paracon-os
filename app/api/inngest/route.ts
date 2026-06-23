import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { recomputeCompliance } from "@/lib/inngest/functions/recompute-compliance";
import { recomputeForecast } from "@/lib/inngest/functions/recompute-forecast";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [recomputeCompliance, recomputeForecast],
});
