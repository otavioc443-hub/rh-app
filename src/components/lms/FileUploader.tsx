"use client";

import { useState } from "react";

export function FileUploader({
  bucket,
  label,
  description,
  onUploaded,
  accept,
}: {
  bucket: "lms-thumbnails" | "lms-banners" | "lms-materials" | "lms-videos";
  label: string;
  description?: string;
  onUploaded: (storageRef: string) => void;
  accept?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleChange(file: File | null) {
    if (!file) return;
    setLoading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("bucket", bucket);

      const response = await fetch("/api/lms/storage/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { storageRef?: string; error?: string };
      if (!response.ok || !data.storageRef) throw new Error(data.error ?? "Falha ao enviar arquivo.");
      onUploaded(data.storageRef);
      setMessage("Arquivo enviado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao enviar arquivo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <label className="grid gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span className="font-semibold text-slate-900">{label}</span>
      {description ? <span className="-mt-1 text-xs text-slate-500">{description}</span> : null}
      <input type="file" accept={accept} disabled={loading} onChange={(event) => void handleChange(event.target.files?.[0] ?? null)} />
      {message ? <span className="text-xs">{message}</span> : null}
    </label>
  );
}
