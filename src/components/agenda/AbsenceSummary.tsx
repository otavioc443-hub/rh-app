"use client";

import { useMemo } from "react";
import type { AbsenceRequest, Profile } from "@/lib/absence";
import { parseISODate, toISODate, addDays } from "@/lib/absence";

function fmtBR(iso: string) {
  const d = parseISODate(iso);
  return d.toLocaleDateString("pt-BR");
}

export default function AbsenceSummary({
  approvedRequests,
  profilesById,
}: {
  approvedRequests: AbsenceRequest[];
  profilesById: Record<string, Profile>;
}) {
  const todayISO = toISODate(new Date());
  const in30ISO = toISODate(addDays(new Date(), 30));

  const { absentToday, next30 } = useMemo(() => {
    const absentToday = approvedRequests.filter(
      (r) => r.start_date <= todayISO && r.end_date >= todayISO
    );

    const next30 = approvedRequests
      .filter((r) => r.start_date <= in30ISO && r.end_date >= todayISO)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    return { absentToday, next30 };
  }, [approvedRequests, todayISO, in30ISO]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">Ausentes hoje</div>
        <div className="mt-2 text-sm text-slate-600">
          {absentToday.length === 0 ? "Ninguém ausente hoje." : ""}
        </div>

        <div className="mt-3 space-y-2">
          {absentToday.map((r) => {
            const p = profilesById[r.user_id];
            return (
              <div key={r.id} className="rounded-xl border p-3">
                <div className="font-medium">{p?.full_name ?? "Colaborador"}</div>
                <div className="text-xs text-slate-600">
                  {fmtBR(r.start_date)} → {fmtBR(r.end_date)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">Próximas ausências (30 dias)</div>
        <div className="mt-3 space-y-2">
          {next30.length === 0 ? (
            <div className="text-sm text-slate-600">Sem ausências programadas nos próximos 30 dias.</div>
          ) : (
            next30.map((r) => {
              const p = profilesById[r.user_id];
              return (
                <div key={r.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{p?.full_name ?? "Colaborador"}</div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      Aprovada
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {fmtBR(r.start_date)} → {fmtBR(r.end_date)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
