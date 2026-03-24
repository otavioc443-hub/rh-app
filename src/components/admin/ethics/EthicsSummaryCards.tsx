"use client";

import { Activity, AlertTriangle, Briefcase, CheckCheck, FileStack, RefreshCcw, SearchCheck, ShieldAlert } from "lucide-react";
import type { EthicsSummary } from "@/lib/ethicsCases/types";

const CARD_CONFIG = [
  { key: "total", label: "Total de registros", icon: FileStack },
  { key: "Recebido", label: "Recebidos", icon: Briefcase },
  { key: "Em triagem", label: "Em triagem", icon: SearchCheck },
  { key: "Em análise", label: "Em análise", icon: Activity },
  { key: "Em investigação", label: "Em investigação", icon: ShieldAlert },
  { key: "Concluído", label: "Concluídos", icon: CheckCheck },
  { key: "Encerrado", label: "Encerrados", icon: AlertTriangle },
  { key: "Reaberto", label: "Reabertos", icon: RefreshCcw },
] as const;

export function EthicsSummaryCards({ summary }: { summary: EthicsSummary }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARD_CONFIG.map((item) => {
        const Icon = item.icon;
        const value = item.key === "total" ? summary.total : summary.byStatus[item.key];
        return (
          <article key={item.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">
                <Icon size={20} />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
