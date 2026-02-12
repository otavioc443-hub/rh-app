"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Key =
  | "comunicacao"
  | "colaboracao"
  | "lideranca"
  | "execucao"
  | "adaptabilidade"
  | "resolucao_problemas";

type Scores = Record<Key, number>;

type CompetenciaRow = {
  id: string;
  user_id: string;
  scores: Scores;
  comment: string | null;
  created_at: string;
};

const CRITERIA: { key: Key; label: string }[] = [
  { key: "comunicacao", label: "Comunicacao" },
  { key: "colaboracao", label: "Colaboracao" },
  { key: "lideranca", label: "Lideranca" },
  { key: "execucao", label: "Execucao" },
  { key: "adaptabilidade", label: "Adaptabilidade" },
  { key: "resolucao_problemas", label: "Resolucao de problemas" },
];

const EMPTY_SCORES: Scores = {
  comunicacao: 3,
  colaboracao: 3,
  lideranca: 3,
  execucao: 3,
  adaptabilidade: 3,
  resolucao_problemas: 3,
};

function normalizeScores(input: unknown): Scores {
  const fallback = { ...EMPTY_SCORES };
  if (!input || typeof input !== "object") return fallback;
  const src = input as Record<string, unknown>;

  for (const c of CRITERIA) {
    const raw = src[c.key];
    const num = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(num)) {
      fallback[c.key] = Math.min(5, Math.max(1, Math.round(num)));
    }
  }
  return fallback;
}

export default function CompetenciasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<CompetenciaRow[]>([]);

  const [scores, setScores] = useState<Scores>({ ...EMPTY_SCORES });
  const [comment, setComment] = useState("");
  const isSetupHint = msg.toLowerCase().includes("supabase/sql/");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        setUserId(null);
        setHistory([]);
        setMsg("Sessao invalida. Faca login novamente.");
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("competencias_assessments")
        .select("id,user_id,scores,comment,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;

      const rows = ((data ?? []) as Array<Omit<CompetenciaRow, "scores"> & { scores: unknown }>).map(
        (r) => ({
          ...r,
          scores: normalizeScores(r.scores),
        })
      );
      setHistory(rows);

      const latest = rows[0];
      if (latest) {
        setScores(latest.scores);
        setComment(latest.comment ?? "");
      } else {
        setScores({ ...EMPTY_SCORES });
        setComment("");
      }
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Erro ao carregar competencias.";
      setMsg(
        `Erro ao carregar competencias: ${text}. Se a tabela nao existe, rode supabase/sql/2026-02-11_create_competencias_assessments.sql.`
      );
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const average = useMemo(() => {
    const values = CRITERIA.map((c) => scores[c.key]);
    const total = values.reduce((acc, n) => acc + n, 0);
    return (total / values.length).toFixed(1);
  }, [scores]);

  async function submit() {
    if (!userId) return;
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        user_id: userId,
        scores,
        comment: comment.trim() || null,
      };
      const { error } = await supabase.from("competencias_assessments").insert(payload);
      if (error) throw error;

      setMsg("Autoavaliacao registrada com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar autoavaliacao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Competencias</h1>
            <p className="mt-1 text-sm text-slate-600">
              Realize sua autoavaliacao periodica de competencias comportamentais e tecnicas.
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
          <p className="text-sm text-slate-500">Autoavaliacoes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{history.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Media atual</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{average}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Escala</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">1 a 5</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-slate-700" />
          <p className="text-sm font-semibold text-slate-900">Nova autoavaliacao</p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {CRITERIA.map((c) => (
            <div key={c.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{c.label}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {scores[c.key]}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={scores[c.key]}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))
                }
                className="mt-3 w-full"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>1</span>
                <span>3</span>
                <span>5</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-900">Comentario (opcional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-300"
            placeholder="Contexto da autoavaliacao, exemplos e plano de evolucao."
          />
        </div>

        <div className="mt-4">
          <button
            onClick={() => void submit()}
            disabled={saving || loading || !userId}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {saving ? "Salvando..." : "Registrar autoavaliacao"}
          </button>
        </div>
      </div>

      {msg ? (
        <div
          className={[
            "rounded-2xl border p-4 text-sm",
            isSetupHint ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700",
          ].join(" ")}
        >
          {msg}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Historico recente</p>
        <div className="mt-4 space-y-3">
          {history.length ? (
            history.map((h) => (
              <div key={h.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(h.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <span className="text-xs text-slate-500">
                    Media:{" "}
                    {(
                      CRITERIA.reduce((acc, c) => acc + h.scores[c.key], 0) / CRITERIA.length
                    ).toFixed(1)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {CRITERIA.map((c) => `${c.label}: ${h.scores[c.key]}`).join(" | ")}
                </p>
                {h.comment ? <p className="mt-2 text-sm text-slate-700">{h.comment}</p> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhuma autoavaliacao registrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
