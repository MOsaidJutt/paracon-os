import { redirect } from "next/navigation";
import { isAiFeatureEnabled } from "@/lib/flags";
import { AiSettingsTable } from "@/components/admin/ai-settings/ai-settings-table";

export default function AdminAiSettingsPage() {
  if (!isAiFeatureEnabled()) redirect("/admin/users");

  return <AiSettingsTable />;
}
