"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

type FeedbackReceived = {
  id: string;
  created_at: string;
  cycle_name: string | null;
  evaluator_name: string | null;
  comment: string | null;
  final_score: number | null;
  final_classification: string | null;
  acknowledged_at: string | null;
  collaborator_comment: string | null;
};

function classificationTone(value: string | null) {
  if (value === "Destaque") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "Bom desempenho") return "border-sky-200 bg-sky-50 text-sky-700";
  if (value === "Atenção") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "Crítico") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function ringColorByClassification(value: string | null) {
  if (value === "Destaque") return "#10b981";
  if (value === "Bom desempenho") return "#0ea5e9";
  if (value === "Atenção") return "#f59e0b";
  if (value === "Crítico") return "#ef4444";
  return "#64748b";
}

function scoreRingStyle(score: number | null, classification: string | null) {
  const safeScore = Number.isFinite(score) ? Number(score) : 0;
  const pct = Math.max(0, Math.min(100, (safeScore / 10) * 100));
  const color = ringColorByClassification(classification);
  return {
    background: `conic-gradient(${color} 0% ${pct}%, #e2e8f0 ${pct}% 100%)`,
  };
}

export default function FeedbackPage() {
  const { loading: roleLoading, role } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [ackSavingId, setAckSavingId] = useState<string | null>(null);
  const [ackDrafts, setAckDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<FeedbackReceived[]>([]);

  const canViewHistory = role === "colaborador";

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/feedback/received", { method: "GET" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao carregar feedbacks recebidos.");
      const nextRows = (json.rows ?? []) as FeedbackReceived[];
      setRows(nextRows);
      setAckDrafts((prev) => {
        const next = { ...prev };
        for (const row of nextRows) {
          if (typeof next[row.id] !== "string") next[row.id] = "";
        }
        return next;
      });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar feedbacks.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (roleLoading || !canViewHistory) return;
    void load();
  }, [roleLoading, canViewHistory]);

  async function acknowledgeFeedback(feedbackId: string) {
    if (!feedbackId) return;
    setMsg("");
    setAckSavingId(feedbackId);
    try {
      const comment = String(ackDrafts[feedbackId] ?? "").trim();
      const res = await fetch("/api/feedback/acknowledgement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_id: feedbackId,
          collaborator_comment: comment,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao confirmar ciencia do feedback.");
      const receipt = (json?.receipt ?? null) as
        | { acknowledged_at?: string | null; collaborator_comment?: string | null }
        | null;
      setRows((prev) =>
        prev.map((row) =>
          row.id === feedbackId
            ? {
                ...row,
                acknowledged_at: String(receipt?.acknowledged_at ?? row.acknowledged_at ?? new Date().toISOString()),
                collaborator_comment:
                  typeof receipt?.collaborator_comment === "string"
                    ? receipt.collaborator_comment
                    : row.collaborator_comment,
              }
            : row
        )
      );
      setAckDrafts((prev) => ({ ...prev, [feedbackId]: "" }));
      setMsg("Ciencia registrada com sucesso.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar ciencia.");
    } finally {
      setAckSavingId(null);
    }
  }

  if (roleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Carregando...</p>
      </div>
    );
  }

  if (!canViewHistory) {
    const nextPath =
      role === "coordenador" || role === "admin"
        ? "/coordenador/feedback"
        : role === "rh"
        ? "/rh/feedbacks"
        : "/home";
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Feedback</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta tela e exclusiva para colaborador visualizar feedback recebido.
        </p>
        <a
          href={nextPath}
          className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Ir para minha area
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Feedback recebido</h1>
            <p className="mt-1 text-sm text-slate-600">
              Historico de devolutivas liberadas para voce dentro do periodo definido pelo RH.
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">Carregando...</div>
          ) : rows.length ? (
            rows.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-sky-50/40 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:justify-between">
                  <div className="flex-1">
                    <p className="text-base font-semibold text-slate-900">{r.cycle_name ?? "Ciclo"}</p>
                    <p className="text-xs text-slate-600">Responsavel pela devolutiva: {r.evaluator_name ?? "Lideranca"}</p>
                    <p className="mt-2 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
                      {r.comment ?? "Sem comentario."}
                    </p>
                    {r.acknowledged_at ? (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-semibold text-emerald-700">Ciencia registrada</p>
                        <p className="mt-1 text-xs text-emerald-800">
                          Confirmado em {new Date(r.acknowledged_at).toLocaleString("pt-BR")}
                        </p>
                        {r.collaborator_comment ? (
                          <div className="mt-2 rounded-lg border border-emerald-200 bg-white p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              Seu comentario
                            </p>
                            <p className="mt-1 text-sm text-slate-700">{r.collaborator_comment}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-800">
                          Confirmacao de ciencia pendente
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          Ao confirmar, voce registra que recebeu esta devolutiva.
                        </p>
                        <textarea
                          value={ackDrafts[r.id] ?? ""}
                          onChange={(e) => setAckDrafts((prev) => ({ ...prev, [r.id]: e.target.value.slice(0, 1000) }))}
                          placeholder="Comentario opcional sobre o feedback (max. 1000 caracteres)"
                          className="mt-2 min-h-[88px] w-full rounded-lg border border-amber-200 bg-white p-2 text-sm text-slate-700 outline-none focus:border-amber-400"
                        />
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-[11px] text-amber-700">
                            {(ackDrafts[r.id] ?? "").length}/1000
                          </p>
                          <button
                            type="button"
                            onClick={() => void acknowledgeFeedback(r.id)}
                            disabled={ackSavingId === r.id}
                            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {ackSavingId === r.id ? "Confirmando..." : "Li e estou ciente"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 md:min-w-[220px]">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-14 rounded-full p-1" style={scoreRingStyle(r.final_score, r.final_classification)}>
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-900">
                          {r.final_score?.toFixed(1) ?? "-"}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Nota media / maxima</p>
                        <p className="text-sm font-semibold text-slate-900">{r.final_score?.toFixed(1) ?? "-"} / 10</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classificationTone(r.final_classification)}`}>
                        Classificação: {r.final_classification ?? "-"}
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500">
                      Data da devolutiva: {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhum feedback disponivel para visualizacao no momento.
            </div>
          )}
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}
