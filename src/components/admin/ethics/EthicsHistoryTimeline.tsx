"use client";

import { Clock3 } from "lucide-react";
import type { EthicsCaseHistoryEntry } from "@/lib/ethicsCases/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function EthicsHistoryTimeline({ history }: { history: EthicsCaseHistoryEntry[] }) {
  if (!history.length) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Nenhuma movimentação registrada ainda.</div>;
  }

  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div key={item.id} className="relative pl-7">
          <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-slate-950" />
          <span className="absolute left-[5px] top-5 h-[calc(100%-0.25rem)] w-px bg-slate-200 last:hidden" />
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Clock3 size={14} />
              <span>{formatDateTime(item.created_at)}</span>
              <span className="text-slate-300">•</span>
              <span>{item.changed_by_name ?? "Sistema"}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {item.previous_status ? `${item.previous_status} → ${item.new_status}` : item.new_status}
            </p>
            {item.comment ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.comment}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
