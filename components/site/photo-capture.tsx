"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/offline/compress-image";
import { enqueuePhoto } from "@/lib/offline/sync-queue";

/** Camera capture → client-side compress → queue immediately (works offline). Reports back a local tempId + preview URL for instant feedback. */
export function PhotoCapture({
  projectId,
  date,
  tag,
  onCaptured,
  label = "Add photo",
}: {
  projectId: string;
  date: string;
  tag: string;
  onCaptured: (tempId: string, previewUrl: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      const tempId = await enqueuePhoto({
        projectId,
        date,
        caption: null,
        tag,
        fileName: file.name,
        blob: compressed,
      });
      onCaptured(tempId, previewUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={label}
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full text-base"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="size-4" />
        {busy ? "Saving photo..." : label}
      </Button>
    </>
  );
}
