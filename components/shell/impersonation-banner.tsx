"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner({ name }: { name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function exit() {
    setLoading(true);
    const res = await fetch("/api/super-admin/impersonate/exit", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      toast.error("Failed to exit impersonation");
      return;
    }
    router.push("/super-admin/organisations");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between bg-amber-500/90 px-4 py-2 text-sm font-medium text-amber-950">
      <span>Impersonating {name} — actions are audited.</span>
      <Button size="sm" variant="outline" className="h-7 border-amber-950/30 bg-transparent text-amber-950 hover:bg-amber-950/10" disabled={loading} onClick={exit}>
        {loading ? "Exiting..." : "Exit impersonation"}
      </Button>
    </div>
  );
}
