"use client";

import { ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { useId, useState } from "react";

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
  const inputId = useId();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");

  async function handleChange(file: File | null) {
    if (!file) return;
    setFileName(file.name);
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
    <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <ImagePlus size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{label}</div>
          {description ? <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div> : null}
        </div>
      </div>

      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={loading}
        className="hidden"
        onChange={(event) => void handleChange(event.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {loading ? "Enviando..." : "Escolher arquivo"}
        </label>
        <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
          {fileName || "Nenhum arquivo escolhido"}
        </div>
      </div>

      {message ? <span className="text-xs font-medium text-slate-500">{message}</span> : null}
    </div>
  );
}
