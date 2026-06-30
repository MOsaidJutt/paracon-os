import { Suspense } from "react";
import { GoogleDriveSettingsForm } from "@/components/admin/google-drive/google-drive-settings-form";

export default function AdminGoogleDrivePage() {
  return (
    <Suspense>
      <GoogleDriveSettingsForm />
    </Suspense>
  );
}
