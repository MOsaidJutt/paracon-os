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
    <div className="flex items-center justify-between bg-rag-amber px-4 py-2 text-sm font-medium text-ink">
      <span>Impersonating {name} — actions are audited.</span>
      <Button size="sm" variant="outline" className="h-7 border-ink/30 bg-transparent text-ink hover:bg-ink/10" disabled={loading} onClick={exit}>
        {loading ? "Exiting..." : "Exit impersonation"}
      </Button>
    </div>
  );
}
