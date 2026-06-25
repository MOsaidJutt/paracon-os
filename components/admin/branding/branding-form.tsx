"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type BrandingData = {
  organisation: {
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    legalName: string | null;
    abn: string | null;
    registeredAddress: string | null;
  };
  allowedSwatches: string[];
};

function LegalEntityCard({ organisation }: { organisation: BrandingData["organisation"] }) {
  const queryClient = useQueryClient();
  const [legalName, setLegalName] = useState(organisation.legalName ?? "");
  const [abn, setAbn] = useState(organisation.abn ?? "");
  const [registeredAddress, setRegisteredAddress] = useState(organisation.registeredAddress ?? "");

  useEffect(() => {
    setLegalName(organisation.legalName ?? "");
    setAbn(organisation.abn ?? "");
    setRegisteredAddress(organisation.registeredAddress ?? "");
  }, [organisation]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalName, abn, registeredAddress }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
    },
    onSuccess: () => {
      toast.success("Legal entity saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "branding"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Legal entity</CardTitle>
        <CardDescription>
          Printed on every generated Tender Letter, Variation and Progress Claim — set once here, never edited in
          a template again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="legal-name">Legal name</Label>
          <Input id="legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="legal-abn">ABN</Label>
          <Input id="legal-abn" value={abn} onChange={(e) => setAbn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="legal-address">Registered address</Label>
          <Input id="legal-address" value={registeredAddress} onChange={(e) => setRegisteredAddress(e.target.value)} />
        </div>
        <Button size="sm" className="self-start" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function BrandingForm() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "branding"],
    queryFn: async () => {
      const res = await fetch("/api/admin/branding");
      if (!res.ok) throw new Error("Failed to load branding");
      return (await res.json()) as BrandingData;
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("logo", file);

    const res = await fetch("/api/admin/branding", { method: "POST", body: formData });
    setUploading(false);
    e.target.value = "";

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to upload logo");
      return;
    }

    toast.success("Logo updated");
    queryClient.invalidateQueries({ queryKey: ["admin", "branding"] });
  }

  const setAccent = useMutation({
    mutationFn: async (primaryColor: string) => {
      const res = await fetch("/api/admin/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update accent colour");
      }
    },
    onSuccess: () => {
      toast.success("Accent colour updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "branding"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
          <CardDescription>PNG, JPEG or WebP, up to 5MB. Shown in the sidebar and topbar.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center rounded-md border border-border bg-muted">
            {data.organisation.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.organisation.logoUrl} alt={data.organisation.name} className="size-16 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading..." : "Upload logo"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accent colour</CardTitle>
          <CardDescription>
            Choose from the brand-approved swatches — kept within guardrails so every tenant still
            feels like OneParacon.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {data.allowedSwatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use accent colour ${swatch}`}
              disabled={setAccent.isPending}
              onClick={() => setAccent.mutate(swatch)}
              className={cn(
                "size-9 rounded-full border-2 transition-transform",
                data.organisation.primaryColor === swatch
                  ? "scale-110 border-foreground"
                  : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </CardContent>
      </Card>

      <LegalEntityCard organisation={data.organisation} />
    </div>
  );
}
