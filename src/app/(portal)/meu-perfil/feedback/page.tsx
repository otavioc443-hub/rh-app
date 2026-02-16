"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

type FeedbackReceived = {
  id: string;
  created_at: string;
  cycle_name: string | null;
  evaluator_name: string | null;
  evaluator_email: string | null;
  comment: string | null;
  scores: Record<string, number> | null;
  source_role: string | null;
};

function avg(scores: Record<string, number> | null) {
  if (!scores) return "-";
  const vals = Object.values(scores);
  if (!vals.length) return "-";
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export default function FeedbackPage() {
  const { loading: roleLoading, role } = useUserRole();
  const [loading, setLoading] = useState(true);
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
      setRows((json.rows ?? []) as FeedbackReceived[]);
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

  const stats = useMemo(() => {
    const total = rows.length;
    const overall = rows.length
      ? (
          rows
            .map((r) => Number(avg(r.scores)))
            .filter((n) => Number.isFinite(n))
            .reduce((a, b) => a + b, 0) / rows.length
        ).toFixed(1)
      : "-";
    const latest = rows[0]?.created_at ? new Date(rows[0].created_at).toLocaleDateString("pt-BR") : "-";
    return { total, overall, latest };
  }, [rows]);

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total de feedbacks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Media geral</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.overall}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Ultima devolutiva</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.latest}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">Carregando...</div>
          ) : rows.length ? (
            rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.cycle_name ?? "Ciclo"}</p>
                    <p className="text-xs text-slate-600">
                      Avaliador: {r.evaluator_name ?? "N/A"} ({r.evaluator_email ?? "N/A"}) | Perfil: {r.source_role ?? "-"}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{r.comment ?? "Sem comentario."}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Media</p>
                    <p className="text-xl font-semibold text-slate-900">{avg(r.scores)}</p>
                    <p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
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
