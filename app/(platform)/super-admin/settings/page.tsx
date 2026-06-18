import { ConfigEditor } from "@/components/admin/settings/config-editor";

export default function SuperAdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide defaults every organisation falls back to unless they override a value.
        </p>
      </div>
      <ConfigEditor apiBase="/api/super-admin/config" queryKey={["super-admin", "config"]} allowReset={false} />
    </div>
  );
}
