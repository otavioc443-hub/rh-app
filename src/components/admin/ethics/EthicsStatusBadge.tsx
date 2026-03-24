"use client";

import type { EthicsCaseStatus } from "@/lib/ethicsCases/types";

const STATUS_STYLES: Record<EthicsCaseStatus, string> = {
  Recebido: "border-sky-200 bg-sky-50 text-sky-700",
  "Em triagem": "border-amber-200 bg-amber-50 text-amber-700",
  "Em análise": "border-violet-200 bg-violet-50 text-violet-700",
  "Em investigação": "border-rose-200 bg-rose-50 text-rose-700",
  Concluído: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Encerrado: "border-slate-200 bg-slate-100 text-slate-700",
  Reaberto: "border-orange-200 bg-orange-50 text-orange-700",
};

export function EthicsStatusBadge({ status }: { status: EthicsCaseStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>{status}</span>;
}
