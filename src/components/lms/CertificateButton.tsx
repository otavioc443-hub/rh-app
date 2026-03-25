"use client";

import { certificatesService } from "@/lib/lms/certificatesService";

export function CertificateButton({ courseId }: { courseId: string }) {
  return (
    <button type="button" onClick={() => certificatesService.open(courseId)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
      Baixar certificado
    </button>
  );
}
