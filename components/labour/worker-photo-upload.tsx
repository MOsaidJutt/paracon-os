"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function WorkerPhotoUpload({ workerId, name, photoUrl }: { workerId: string; name: string; photoUrl: string | null }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/workers/${workerId}/photo`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Photo updated");
      queryClient.invalidateQueries({ queryKey: ["labour"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="relative">
      <Avatar className="size-20">
        <AvatarImage src={photoUrl ?? undefined} alt={name} />
        <AvatarFallback className="text-lg">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="absolute -bottom-1 -right-1 size-7 rounded-full"
        onClick={() => inputRef.current?.click()}
        disabled={mutation.isPending}
      >
        <Camera className="size-3.5" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) mutation.mutate(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
