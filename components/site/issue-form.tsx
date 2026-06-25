"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoCapture } from "./photo-capture";
import { enqueueIssue } from "@/lib/offline/sync-queue";

/** "One screen, severity chips, photo, send" — collapsed to a single button until tapped, to keep the default flow short. */
export function IssueForm({
  projectId,
  date,
  severityList,
  onSent,
}: {
  projectId: string;
  date: string;
  severityList: string[];
  onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(severityList[0] ?? "Low");
  const [photoTempIds, setPhotoTempIds] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!description.trim()) return;
    setSending(true);
    try {
      await enqueueIssue({ projectId, date, description: description.trim(), severity, photoTempIds });
      setDescription("");
      setSeverity(severityList[0] ?? "Low");
      setPhotoTempIds([]);
      setPhotoPreviews([]);
      setOpen(false);
      onSent();
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={() => setOpen(true)}>
        Raise an issue
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Raise an issue</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          placeholder="What's the issue?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-24 text-base"
        />
        <div className="flex gap-2">
          {severityList.map((s) => (
            <Button
              key={s}
              type="button"
              variant={severity === s ? "default" : "outline"}
              className="h-12 flex-1 text-base"
              onClick={() => setSeverity(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        {photoPreviews.length > 0 && (
          <div className="flex gap-2">
            {photoPreviews.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="Issue evidence" className="h-16 w-16 rounded-md object-cover" />
            ))}
          </div>
        )}
        <PhotoCapture
          projectId={projectId}
          date={date}
          tag="Issue"
          label="Attach photo"
          onCaptured={(tempId, previewUrl) => {
            setPhotoTempIds((ids) => [...ids, tempId]);
            setPhotoPreviews((p) => [...p, previewUrl]);
          }}
        />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="h-12 flex-1 text-base" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="h-12 flex-1 text-base" disabled={!description.trim() || sending} onClick={handleSend}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
