"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, XCircle, RefreshCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { AbsenceRequest, Allowance } from "@/lib/absence";
import { addDays, diffDaysInclusive, toISODate } from "@/lib/absence";
import AbsenceCalendar from "@/components/agenda/AbsenceCalendar";

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "pending_manager") return "Pendente";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  if (status === "cancelled") return "Cancelada";
  return status;
}

function statusClass(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "pending_manager") return "bg-amber-50 text-amber-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function fmtBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export default function AusenciasProgramadasPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [myAllowance, setMyAllowance] = useState<Allowance | null>(null);
  const [myRequests, setMyRequests] = useState<AbsenceRequest[]>([]);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editReason, setEditReason] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        setMyAllowance(null);
        setMyRequests([]);
        setMsg("Sessao invalida. Faca login novamente.");
        return;
      }

      const { data: allowances, error: allowanceErr } = await supabase
        .from("absence_allowances")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      if (allowanceErr) throw allowanceErr;

      setMyAllowance((allowances?.[0] as Allowance | undefined) ?? null);

      const { data: requests, error: reqErr } = await supabase
        .from("absence_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (reqErr) throw reqErr;

      setMyRequests((requests ?? []) as AbsenceRequest[]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar ausencias.");
      setMyAllowance(null);
      setMyRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const approvedUsed = useMemo(() => {
    return myRequests
      .filter((r) => r.status === "approved")
      .reduce((acc, r) => acc + (r.days_count ?? 0), 0);
  }, [myRequests]);

  const pendingCount = useMemo(
    () => myRequests.filter((r) => r.status === "pending_manager").length,
    [myRequests]
  );

  const approved30 = useMemo(() => {
    const today = toISODate(new Date());
    const in30 = toISODate(addDays(new Date(), 30));
    return myRequests.filter(
      (r) => r.status === "approved" && r.start_date <= in30 && r.end_date >= today
    ).length;
  }, [myRequests]);

  const daysAllowed = myAllowance?.max_days ?? 0;
  const daysRemaining = Math.max(0, daysAllowed - approvedUsed);

  function startEditRequest(r: AbsenceRequest) {
    setEditingRequestId(r.id);
    setEditStartDate(r.start_date);
    setEditEndDate(r.end_date);
    setEditReason((r.reason ?? "").trim());
    setMsg("");
  }

  function cancelEditRequest() {
    setEditingRequestId(null);
    setEditStartDate("");
    setEditEndDate("");
    setEditReason("");
  }

  async function handleSaveRequestEdit(r: AbsenceRequest) {
    if (!(r.status === "pending_manager" || r.status === "rejected")) return;
    if (!editStartDate || !editEndDate) return setMsg("Informe inicio e fim.");
    if (editEndDate < editStartDate) return setMsg("Data final nao pode ser menor que a inicial.");
    if (myAllowance) {
      if (editStartDate < myAllowance.valid_from || editEndDate > myAllowance.valid_to) {
        return setMsg("Periodo fora da janela liberada pelo RH.");
      }
    }
    const nextDays = diffDaysInclusive(editStartDate, editEndDate);
    setSavingRequestId(r.id);
    setMsg("");
    try {
      const updatePayload = {
        start_date: editStartDate,
        end_date: editEndDate,
        days_count: nextDays,
        reason: editReason.trim() || null,
        status: "pending_manager" as const,
        manager_comment: null,
      };
      const { error } = await supabase
        .from("absence_requests")
        .update(updatePayload)
        .eq("id", r.id)
        .in("status", ["pending_manager", "rejected"]);
      if (error) throw error;
      await fetch("/api/ausencias/requests/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updated", requests: [{ ...r, ...updatePayload }] }),
      }).catch(() => null);
      cancelEditRequest();
      setMsg("Solicitacao atualizada com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao editar solicitacao.");
    } finally {
      setSavingRequestId(null);
    }
  }

  async function handleCancelRequest(r: AbsenceRequest) {
    if (!(r.status === "pending_manager" || r.status === "rejected")) return;
    const ok = window.confirm("Cancelar esta solicitacao de ausencia?");
    if (!ok) return;
    setSavingRequestId(r.id);
    setMsg("");
    try {
      const { error } = await supabase
        .from("absence_requests")
        .update({ status: "cancelled" })
        .eq("id", r.id)
        .in("status", ["pending_manager", "rejected"]);
      if (error) throw error;
      await fetch("/api/ausencias/requests/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelled", requests: [{ ...r, status: "cancelled" }] }),
      }).catch(() => null);
      if (editingRequestId === r.id) cancelEditRequest();
      setMsg("Solicitacao cancelada.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao cancelar solicitacao.");
    } finally {
      setSavingRequestId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Ausencias programadas</h1>
            <p className="mt-1 text-sm text-slate-600">
              Solicite ausencias dentro da janela liberada pelo RH e acompanhe aprovacao.
            </p>
          </div>

          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Dias liberados" value={String(daysAllowed)} icon={CalendarClock} />
        <KpiCard label="Solicitacoes pendentes" value={String(pendingCount)} icon={Clock3} />
        <KpiCard label="Aprovadas (30 dias)" value={String(approved30)} icon={CheckCircle2} />
      </div>

      {myAllowance ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Janela liberada: <b>{fmtBR(myAllowance.valid_from)}</b> ate <b>{fmtBR(myAllowance.valid_to)}</b> | Cota:
          <b> {daysAllowed}</b> dia(s) | Usado: <b>{approvedUsed}</b> | Restante: <b>{daysRemaining}</b>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Voce ainda nao tem liberacao ativa de ausencias. Solicite ao RH.
        </div>
      )}

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
      ) : null}

      {!loading ? (
        <AbsenceCalendar myAllowance={myAllowance} myRequests={myRequests} onRefresh={load} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Carregando calendario...
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Minhas solicitacoes</p>
            <p className="mt-1 text-sm text-slate-600">Historico completo de pedidos de ausencia.</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Periodo</th>
                <th className="p-3">Dias</th>
                <th className="p-3">Status</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Criada em</th>
                <th className="p-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.length ? (
                myRequests.map((r) => {
                  const isEditable = r.status === "pending_manager" || r.status === "rejected";
                  const isEditing = editingRequestId === r.id;
                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-3">
                        {isEditing ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => setEditStartDate(e.target.value)}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            />
                            <input
                              type="date"
                              value={editEndDate}
                              onChange={(e) => setEditEndDate(e.target.value)}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            />
                          </div>
                        ) : (
                          <>{fmtBR(r.start_date)} - {fmtBR(r.end_date)}</>
                        )}
                      </td>
                      <td className="p-3">{isEditing ? diffDaysInclusive(editStartDate, editEndDate) : r.days_count}</td>
                      <td className="p-3">
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            statusClass(r.status),
                          ].join(" ")}
                        >
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              placeholder="Motivo (opcional)"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                            />
                          ) : (
                            <div>{r.reason ?? "-"}</div>
                          )}
                          {r.status === "rejected" && (r.manager_comment ?? "").trim() ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                              Motivo da recusa: {r.manager_comment}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-3">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end">
                          <div className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Acoes da solicitacao
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                          {isEditable && !isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditRequest(r)}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={savingRequestId === r.id}
                                onClick={() => void handleCancelRequest(r)}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : null}
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={savingRequestId === r.id}
                                onClick={() => void handleSaveRequestEdit(r)}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                disabled={savingRequestId === r.id}
                                onClick={cancelEditRequest}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                Cancelar acao
                              </button>
                            </>
                          ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Nenhuma solicitacao para exibir.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <Clock3 size={14} /> Pendente
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <CheckCircle2 size={14} /> Aprovada
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <XCircle size={14} /> Recusada
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Atalhos</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link
            href="/notificacoes"
            className="block rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 hover:bg-slate-50"
          >
            Ver notificacoes
          </Link>
          <Link
            href="/agenda"
            className="block rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 hover:bg-slate-50"
          >
            Ir para agenda
          </Link>
        </div>
      </div>
    </div>
  );
}
