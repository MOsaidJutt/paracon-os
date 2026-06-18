import { ConfigEditor } from "@/components/admin/settings/config-editor";

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Override platform defaults for your organisation. Anything you don&apos;t override falls
        back to the platform default set by a super admin.
      </p>
      <ConfigEditor apiBase="/api/admin/config" queryKey={["admin", "config"]} allowReset />
    </div>
  );
}
