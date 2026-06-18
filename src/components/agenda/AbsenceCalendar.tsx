"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AbsenceRequest, Allowance } from "@/lib/absence";
import { toISODate, addDays, diffDaysInclusive, overlaps } from "@/lib/absence";

type Props = {
  myAllowance: Allowance | null;
  myRequests: AbsenceRequest[];
  onRefresh: () => Promise<void>;
};

type AbsenceNotifyResponse = {
  emailFailed?: number;
  emailSkipped?: number;
  error?: string;
};

function monthLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function dayOfWeekMonFirst(d: Date) {
  // JS: 0=Dom ... 6=Sáb -> queremos 0=Seg
  const js = d.getDay();
  return (js + 6) % 7;
}

function fmtBR(iso: string) {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("pt-BR");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function allowanceStart(allowance: Allowance) {
  return allowance.window_start ?? allowance.valid_from;
}

function allowanceEnd(allowance: Allowance) {
  return allowance.window_end ?? allowance.valid_to;
}

function allowanceDays(allowance: Allowance) {
  return Number(allowance.days_allowed ?? allowance.max_days ?? 0) || 0;
}

function isTakenAbsence(request: Pick<AbsenceRequest, "end_date" | "manager_comment" | "reason">) {
  const marker = normalizeText(`${request.manager_comment ?? ""} ${request.reason ?? ""}`);
  if (marker.includes("ja tirada") || marker.includes("ja tirado") || marker.includes("efetivamente tirada")) return true;
  return request.end_date < toISODate(new Date());
}

export default function AbsenceCalendar({ myAllowance, myRequests, onRefresh }: Props) {
  const [cursor, setCursor] = useState(() => new Date());
  const [startISO, setStartISO] = useState<string>(toISODate(new Date()));
  const [endISO, setEndISO] = useState<string>(toISODate(new Date()));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const monthDays = useMemo(() => {
    const s = startOfMonth(cursor);
    const e = endOfMonth(cursor);
    const pad = dayOfWeekMonFirst(s);

    const days: { date: Date; inMonth: boolean }[] = [];
    // padding anterior
    for (let i = 0; i < pad; i++) days.push({ date: addDays(s, -(pad - i)), inMonth: false });
    // dias do mês
    for (let d = new Date(s); d <= e; d = addDays(d, 1)) days.push({ date: new Date(d), inMonth: true });
    // padding final até múltiplo de 7
    while (days.length % 7 !== 0) days.push({ date: addDays(e, days.length - (pad + (e.getDate())) + 1), inMonth: false });

    return days;
  }, [cursor]);

  const usedDaysApproved = useMemo(() => {
    return myRequests
      .filter((r) => r.status === "approved")
      .reduce((acc, r) => acc + (r.days_count ?? diffDaysInclusive(r.start_date, r.end_date)), 0);
  }, [myRequests]);

  const remainingDays = useMemo(() => {
    if (!myAllowance || !myAllowance.is_active) return 0;
    return Math.max(0, allowanceDays(myAllowance) - usedDaysApproved);
  }, [myAllowance, usedDaysApproved]);

  function statusBadge(iso: string) {
    const match = myRequests.find(
      (r) => r.start_date <= iso && r.end_date >= iso && r.status !== "cancelled"
    );
    if (!match) return null;
    if (match.status === "approved" && isTakenAbsence(match)) return <span className="ml-1 text-xs text-emerald-700">●</span>;
    if (match.status === "approved") return <span className="ml-1 text-xs text-blue-700">●</span>;
    if (match.status === "pending_manager") return <span className="ml-1 text-xs text-amber-700">●</span>;
    if (match.status === "rejected") return <span className="ml-1 text-xs text-rose-700">●</span>;

    return null;
  }

  function canRequest(iso: string) {
    if (!myAllowance || !myAllowance.is_active) return false;
    if (iso < allowanceStart(myAllowance) || iso > allowanceEnd(myAllowance)) return false;
    return true;
  }

  async function resolveManagerId() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch("/api/me/absence-manager", {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const payload = (await response.json()) as { managerId?: string | null; error?: string };

    if (!response.ok || !payload.managerId) {
      throw new Error(payload.error || "Gestor direto nao encontrado para aprovacao.");
    }

    return payload.managerId;
  }

  async function submitRequest() {
    setMsg("");
    setLoading(true);
    try {
      const { data: userData, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      const user = userData.user;
      if (!user) throw new Error("Sessão inválida");

      // 1) pegar gestor do profile ou do superior direto vinculado no colaborador
      const managerId = await resolveManagerId();
      if (!managerId) throw new Error("Gestor nao encontrado para aprovacao.");

      // 2) validações: allowance
      if (!myAllowance || !myAllowance.is_active) throw new Error("Sem liberação de ausências pelo RH.");
      if (startISO > endISO) throw new Error("Data início não pode ser maior que data fim.");
      if (startISO < allowanceStart(myAllowance) || endISO > allowanceEnd(myAllowance))
        throw new Error("Período fora da janela liberada pelo RH.");

      const days = diffDaysInclusive(startISO, endISO);
      if (days > remainingDays) throw new Error(`Você só pode solicitar mais ${remainingDays} dia(s).`);

      // 3) impedir conflito com ausência aprovada/pendente
      const conflict = myRequests.find((r) =>
        r.status !== "cancelled" && overlaps(r.start_date, r.end_date, startISO, endISO)
      );
      if (conflict) throw new Error("Conflito com uma solicitação existente no período.");

      // 4) criar solicitação
      const insertPayload = {
        user_id: user.id,
        manager_id: managerId,
        allowance_id: myAllowance.id,
        start_date: startISO,
        end_date: endISO,
        days_count: days,
        reason: reason.trim() ? reason.trim() : null,
        status: "pending_manager",
      };
      const { error: ierr } = await supabase.from("absence_requests").insert(insertPayload);

      if (ierr) throw ierr;
      const notifyResponse = await fetch("/api/ausencias/requests/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "created", requests: [insertPayload] }),
      });
      const notifyPayload = (await notifyResponse.json().catch(() => null)) as AbsenceNotifyResponse | null;

      setReason("");
      if (!notifyResponse.ok || notifyPayload?.emailFailed || notifyPayload?.emailSkipped) {
        setMsg("Solicitacao criada, mas houve falha ao notificar o gestor. Avise o RH para verificar o envio.");
      } else {
        setMsg("Solicitacao enviada ao gestor para aprovacao.");
      }
      await onRefresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao solicitar ausência.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold capitalize">{monthLabel(cursor)}</div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              ←
            </button>
            <button
              className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => setCursor(new Date())}
            >
              Hoje
            </button>
            <button
              className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              →
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-2 text-xs text-slate-500">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((x) => (
            <div key={x} className="px-1">{x}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {monthDays.map(({ date, inMonth }, idx) => {
            const iso = toISODate(date);
            const blocked = !canRequest(iso);
            return (
              <div
                key={idx}
                className={[
                  "rounded-xl border p-2 text-sm",
                  inMonth ? "bg-white" : "bg-slate-50 text-slate-400",
                  blocked ? "opacity-60" : "",
                ].join(" ")}
                title={blocked ? "Fora da janela liberada pelo RH" : "Clique e use no formulário ao lado"}
              >
                <div className="flex items-center justify-between">
                  <span>{date.getDate()}</span>
                  {statusBadge(iso)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-xs text-slate-600">
          ● <span className="text-emerald-700">Aprovada</span> | ●{" "}
          <span className="text-amber-700">Pendente</span> | ●{" "}
          <span className="text-rose-700">Reprovada</span>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">Solicitar ausência</div>

        <div className="mt-3 space-y-3">
          <div className="rounded-xl border bg-slate-50 p-3 text-sm">
            <div className="font-medium">Sua liberação</div>
            {myAllowance ? (
              <div className="mt-1 text-xs text-slate-700">
                Janela: <b>{fmtBR(allowanceStart(myAllowance))}</b> - <b>{fmtBR(allowanceEnd(myAllowance))}</b>
                <br />
                Cota: <b>{allowanceDays(myAllowance)}</b> dia(s) - Usado: <b>{usedDaysApproved}</b> - Restante:{" "}
                <b>{remainingDays}</b>
              </div>
            ) : (
              <div className="mt-1 text-xs text-slate-700">
                Você ainda não tem liberação de ausências pelo RH.
              </div>
            )}
          </div>

          <label className="block text-xs text-slate-600">
            Data início
            <input
              type="date"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={startISO}
              onChange={(e) => setStartISO(e.target.value)}
            />
          </label>

          <label className="block text-xs text-slate-600">
            Data fim
            <input
              type="date"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={endISO}
              onChange={(e) => setEndISO(e.target.value)}
            />
          </label>

          <label className="block text-xs text-slate-600">
            Motivo (opcional)
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: compromisso médico, estudo, etc."
            />
          </label>

          {msg ? <div className="text-sm text-slate-700">{msg}</div> : null}

          <button
            onClick={submitRequest}
            disabled={loading || !myAllowance}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Solicitar"}
          </button>

          <div className="text-xs text-slate-500">
            Após solicitar, seu gestor recebe a aprovação e você será notificado aqui no portal.
          </div>
        </div>
      </div>
    </div>
  );
}
