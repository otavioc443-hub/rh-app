"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AbsenceRequest, Allowance, Profile } from "@/lib/absence";
import AbsenceCalendar from "@/components/agenda/AbsenceCalendar";
import AbsenceSummary from "@/components/agenda/AbsenceSummary";
import { addDays, toISODate } from "@/lib/absence";

export default function AgendaPage() {
  const [myAllowance, setMyAllowance] = useState<Allowance | null>(null);
  const [myRequests, setMyRequests] = useState<AbsenceRequest[]>([]);
  const [approvedTeam, setApprovedTeam] = useState<AbsenceRequest[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const { data: allowances } = await supabase
        .from("absence_allowances")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      setMyAllowance((allowances?.[0] as Allowance | undefined) ?? null);

      const { data: requests } = await supabase
        .from("absence_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setMyRequests((requests ?? []) as AbsenceRequest[]);

      const today = toISODate(new Date());
      const in30 = toISODate(addDays(new Date(), 30));

      const { data: approved } = await supabase
        .from("absence_requests")
        .select("*")
        .eq("status", "approved")
        .lte("start_date", in30)
        .gte("end_date", today)
        .order("start_date", { ascending: true });

      const approvedRows = (approved ?? []) as AbsenceRequest[];
      setApprovedTeam(approvedRows);

      const ids = Array.from(new Set(approvedRows.map((r) => r.user_id)));
      if (ids.length > 0) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, full_name, role, manager_id")
          .in("id", ids);

        const map: Record<string, Profile> = {};
        for (const p of (ps ?? []) as Profile[]) {
          map[p.id] = p;
        }
        setProfilesById(map);
      } else {
        setProfilesById({});
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const approvedForSummary = useMemo(() => approvedTeam, [approvedTeam]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="text-sm text-slate-600">
          Acompanhe ausencias programadas, solicite dentro do periodo liberado pelo RH e veja aprovacoes.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">Carregando...</div>
      ) : (
        <>
          <AbsenceSummary approvedRequests={approvedForSummary} profilesById={profilesById} />
          <AbsenceCalendar myAllowance={myAllowance} myRequests={myRequests} onRefresh={load} />
        </>
      )}
    </div>
  );
}
