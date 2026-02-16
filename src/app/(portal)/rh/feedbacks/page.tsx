"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";

type FeedbackRow = {
  id: string;
  created_at: string;
  target_name: string | null;
  target_email: string | null;
  evaluator_name: string | null;
  evaluator_email: string | null;
  source_role: string | null;
  comment: string | null;
  released_to_collaborator: boolean | null;
};

export default function RHFeedbacksPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<FeedbackRow[]>([]);

  const [name, setName] = useState("");
  const [collectStart, setCollectStart] = useState("");
  const [collectEnd, setCollectEnd] = useState("");
  const [releaseStart, setReleaseStart] = useState("");
  const [releaseEnd, setReleaseEnd] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [cycleRes, rowsRes] = await Promise.all([
        fetch("/api/feedback/cycle", { method: "GET" }),
        fetch("/api/feedback/rh", { method: "GET" }),
      ]);
      const cycleJson = await cycleRes.json();
      const rowsJson = await rowsRes.json();
      if (!cycleRes.ok) throw new Error(cycleJson?.error ?? "Falha ao carregar ciclo.");
      if (!rowsRes.ok) throw new Error(rowsJson?.error ?? "Falha ao carregar feedbacks.");

      setRows((rowsJson.rows ?? []) as FeedbackRow[]);

      if (cycleJson.cycle) {
        setName(String(cycleJson.cycle.name ?? ""));
        setCollectStart(String(cycleJson.cycle.collect_start ?? "").slice(0, 16));
        setCollectEnd(String(cycleJson.cycle.collect_end ?? "").slice(0, 16));
        setReleaseStart(String(cycleJson.cycle.release_start ?? "").slice(0, 16));
        setReleaseEnd(String(cycleJson.cycle.release_end ?? "").slice(0, 16));
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveCycle() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/feedback/cycle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          collect_start: new Date(collectStart).toISOString(),
          collect_end: new Date(collectEnd).toISOString(),
          release_start: new Date(releaseStart).toISOString(),
          release_end: new Date(releaseEnd).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao salvar ciclo.");
      setMsg("Ciclo de feedback atualizado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar ciclo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRelease(feedbackId: string, release: boolean) {
    setMsg("");
    try {
      const res = await fetch("/api/feedback/rh", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_id: feedbackId,
          released_to_collaborator: release,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao atualizar liberacao.");
      setRows((prev) => prev.map((r) => (r.id === feedbackId ? { ...r, released_to_collaborator: release } : r)));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">RH - Governanca de Feedback</h1>
            <p className="mt-1 text-sm text-slate-600">
              Defina janelas de coleta/disponibilizacao e acompanhe feedbacks aplicados.
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
        <h2 className="text-sm font-semibold text-slate-900">Periodo de feedback</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do ciclo (ex.: 1o Semestre 2026)"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
          />
          <label className="text-xs text-slate-600">
            Coleta inicio
            <input
              type="datetime-local"
              value={collectStart}
              onChange={(e) => setCollectStart(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="text-xs text-slate-600">
            Coleta fim
            <input
              type="datetime-local"
              value={collectEnd}
              onChange={(e) => setCollectEnd(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="text-xs text-slate-600">
            Liberacao inicio
            <input
              type="datetime-local"
              value={releaseStart}
              onChange={(e) => setReleaseStart(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="text-xs text-slate-600">
            Liberacao fim
            <input
              type="datetime-local"
              value={releaseEnd}
              onChange={(e) => setReleaseEnd(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
        </div>
        <button
          onClick={() => void saveCycle()}
          disabled={saving || loading}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar ciclo"}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Feedbacks aplicados</h2>
        <div className="mt-4 space-y-3">
          {rows.length ? (
            rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {r.target_name ?? "Colaborador"} ({r.target_email ?? "sem email"})
                    </p>
                    <p className="text-xs text-slate-600">
                      Avaliador: {r.evaluator_name ?? "N/A"} ({r.evaluator_email ?? "N/A"}) | Perfil:{" "}
                      {r.source_role ?? "-"}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{r.comment ?? "-"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void toggleRelease(r.id, true)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                    >
                      Liberar
                    </button>
                    <button
                      onClick={() => void toggleRelease(r.id, false)}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                    >
                      Ocultar
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhum feedback registrado.
            </div>
          )}
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div>
      ) : null}
    </div>
  );
}
