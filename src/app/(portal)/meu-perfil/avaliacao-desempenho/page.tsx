"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, CheckCircle2, RefreshCcw, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Score = 1 | 2 | 3 | 4 | 5;

type Assessment = {
  id: string;
  user_id: string;
  period_label: string;
  goals_score: Score;
  quality_score: Score;
  productivity_score: Score;
  behavior_score: Score;
  manager_feedback: string | null;
  self_comment: string | null;
  created_at: string;
};

function avg(row: Pick<Assessment, "goals_score" | "quality_score" | "productivity_score" | "behavior_score">) {
  const v = row.goals_score + row.quality_score + row.productivity_score + row.behavior_score;
  return (v / 4).toFixed(1);
}

export default function AvaliacaoDesempenhoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<Assessment[]>([]);

  const [periodLabel, setPeriodLabel] = useState("");
  const [goalsScore, setGoalsScore] = useState<Score>(3);
  const [qualityScore, setQualityScore] = useState<Score>(3);
  const [productivityScore, setProductivityScore] = useState<Score>(3);
  const [behaviorScore, setBehaviorScore] = useState<Score>(3);
  const [selfComment, setSelfComment] = useState("");

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
        .from("performance_assessments")
        .select(
          "id,user_id,period_label,goals_score,quality_score,productivity_score,behavior_score,manager_feedback,self_comment,created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;

      setHistory((data ?? []) as Assessment[]);
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Erro ao carregar avaliacoes.";
      setMsg(
        `Erro ao carregar avaliacao de desempenho: ${text}. Rode supabase/sql/2026-02-11_create_performance_assessments.sql se a tabela nao existir.`
      );
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const currentAverage = useMemo(
    () =>
      avg({
        goals_score: goalsScore,
        quality_score: qualityScore,
        productivity_score: productivityScore,
        behavior_score: behaviorScore,
      }),
    [goalsScore, qualityScore, productivityScore, behaviorScore]
  );

  const lastAverage = useMemo(() => (history[0] ? avg(history[0]) : "-"), [history]);

  async function submit() {
    if (!userId) return;
    if (!periodLabel.trim()) {
      setMsg("Informe o periodo da avaliacao. Ex.: 2026 Q1");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        user_id: userId,
        period_label: periodLabel.trim(),
        goals_score: goalsScore,
        quality_score: qualityScore,
        productivity_score: productivityScore,
        behavior_score: behaviorScore,
        self_comment: selfComment.trim() || null,
      };

      const { error } = await supabase.from("performance_assessments").insert(payload);
      if (error) throw error;

      setPeriodLabel("");
      setGoalsScore(3);
      setQualityScore(3);
      setProductivityScore(3);
      setBehaviorScore(3);
      setSelfComment("");

      setMsg("Autoavaliacao de desempenho registrada.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar avaliacao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Avaliacao de desempenho</h1>
            <p className="mt-1 text-sm text-slate-600">
              Registre sua autoavaliacao por periodo e acompanhe seu historico de evolucao.
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
          <p className="text-sm text-slate-500">Avaliacoes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{history.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Media atual</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{currentAverage}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Ultima media registrada</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{lastAverage}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-slate-700" />
          <p className="text-sm font-semibold text-slate-900">Nova autoavaliacao</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="Periodo (ex.: 2026 Q1)"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Metas
            <input
              type="range"
              min={1}
              max={5}
              value={goalsScore}
              onChange={(e) => setGoalsScore(Number(e.target.value) as Score)}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm text-slate-700">
            Qualidade
            <input
              type="range"
              min={1}
              max={5}
              value={qualityScore}
              onChange={(e) => setQualityScore(Number(e.target.value) as Score)}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm text-slate-700">
            Produtividade
            <input
              type="range"
              min={1}
              max={5}
              value={productivityScore}
              onChange={(e) => setProductivityScore(Number(e.target.value) as Score)}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm text-slate-700">
            Comportamento
            <input
              type="range"
              min={1}
              max={5}
              value={behaviorScore}
              onChange={(e) => setBehaviorScore(Number(e.target.value) as Score)}
              className="mt-2 w-full"
            />
          </label>
        </div>

        <textarea
          value={selfComment}
          onChange={(e) => setSelfComment(e.target.value)}
          className="mt-4 min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-300"
          placeholder="Comentario de autoavaliacao (opcional)"
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void submit()}
            disabled={saving || loading || !userId}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {saving ? "Salvando..." : "Registrar avaliacao"}
          </button>
          <span className="inline-flex items-center gap-1 text-sm text-slate-600">
            <TrendingUp size={14} />
            Media atual: {currentAverage}
          </span>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Historico</p>
        <div className="mt-4 space-y-3">
          {history.length ? (
            history.map((h) => (
              <div key={h.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <p className="font-medium text-slate-900">{h.period_label}</p>
                  <span className="text-xs text-slate-500">
                    {new Date(h.created_at).toLocaleDateString("pt-BR")} | Media {avg(h)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Metas: {h.goals_score} | Qualidade: {h.quality_score} | Produtividade: {h.productivity_score} |
                  Comportamento: {h.behavior_score}
                </p>
                {h.manager_feedback ? (
                  <p className="mt-2 text-sm text-slate-700">
                    <b>Feedback gestor:</b> {h.manager_feedback}
                  </p>
                ) : null}
                {h.self_comment ? <p className="mt-1 text-sm text-slate-700">{h.self_comment}</p> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhuma avaliacao registrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
