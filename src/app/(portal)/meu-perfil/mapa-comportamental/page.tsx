"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Layers3, RefreshCcw, User2, Users } from "lucide-react";
import {
  BEHAVIOR_ADJECTIVES,
  BEHAVIOR_AXIS_META,
  calculateBehaviorAxisResults,
  calculateBehaviorCompetencies,
  calculateBehaviorFactorResults,
  calculateBehaviorIsolatedProfile,
  calculateBehaviorLeadershipProfile,
  combineBehaviorAxisResults,
  getBehaviorConfidence,
  getBehaviorAttentionCount,
  getBehaviorClassificationLabel,
  getBehaviorSummaryLine,
  getPredominantBehaviorAxes,
  type BehaviorFactorResult,
  type BehaviorIsolatedProfilePoint,
  type BehaviorLeadershipPoint,
  type BehaviorCompetencyPoint,
  type BehaviorAxisResult,
} from "@/lib/behaviorProfile";
import { supabase } from "@/lib/supabaseClient";

type Step = 2 | 3;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
}

function sortResults(results: BehaviorAxisResult[]) {
  return [...results].sort((a, b) => b.percent - a.percent || b.score - a.score);
}

export default function MapaComportamentalPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      created_at: string;
      predominant_self: string[] | null;
      predominant_others: string[] | null;
      self_result: BehaviorAxisResult[];
      others_result: BehaviorAxisResult[];
    }>
  >([]);
  const [activeRelease, setActiveRelease] = useState<{
    id: string;
    window_start: string;
    window_end: string;
  } | null>(null);
  const [step, setStep] = useState<Step>(2);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selfSelected, setSelfSelected] = useState<string[]>([]);
  const [othersSelected, setOthersSelected] = useState<string[]>([]);

  const selfResults = useMemo(
    () => sortResults(calculateBehaviorAxisResults(selfSelected)),
    [selfSelected]
  );
  const othersResults = useMemo(
    () => sortResults(calculateBehaviorAxisResults(othersSelected)),
    [othersSelected]
  );
  const consolidatedResults = useMemo(
    () => sortResults(combineBehaviorAxisResults(selfResults, othersResults, 0.7)),
    [selfResults, othersResults]
  );
  const othersFactorResults = useMemo(
    () => calculateBehaviorFactorResults(othersSelected),
    [othersSelected]
  );
  const isolatedProfile = useMemo(
    () => calculateBehaviorIsolatedProfile(selfResults, othersResults),
    [selfResults, othersResults]
  );
  const leadershipProfile = useMemo(
    () => calculateBehaviorLeadershipProfile(selfResults, othersResults),
    [selfResults, othersResults]
  );
  const competencyProfile = useMemo(
    () => calculateBehaviorCompetencies(consolidatedResults, othersFactorResults, leadershipProfile),
    [consolidatedResults, othersFactorResults, leadershipProfile]
  );

  const predominantSelf = useMemo(() => getPredominantBehaviorAxes(selfResults), [selfResults]);
  const predominantOthers = useMemo(() => getPredominantBehaviorAxes(othersResults), [othersResults]);
  const predominantConsolidated = useMemo(
    () => getPredominantBehaviorAxes(consolidatedResults),
    [consolidatedResults]
  );

  const selfAttentionCount = useMemo(
    () => getBehaviorAttentionCount(selfSelected),
    [selfSelected]
  );
  const othersAttentionCount = useMemo(
    () => getBehaviorAttentionCount(othersSelected),
    [othersSelected]
  );

  const canGoStep2 = true;
  const canGoStep3 = selfSelected.length > 0;
  const personName = fullName.trim() || "O colaborador";
  const todayIso = new Date().toISOString().slice(0, 10);
  const canPerformAssessment = !!activeRelease;

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
      setFullName((prev) => prev || (user.user_metadata?.full_name as string) || "");
      setEmail((prev) => prev || user.email || "");

      const { data, error } = await supabase
        .from("behavior_assessments")
        .select("id,created_at,predominant_self,predominant_others,self_result,others_result")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string;
        created_at: string;
        predominant_self: string[] | null;
        predominant_others: string[] | null;
        self_result: BehaviorAxisResult[];
        others_result: BehaviorAxisResult[];
      }>;
      setHistory(rows);

      const releaseRes = await supabase
        .from("behavior_assessment_releases")
        .select("id,window_start,window_end,is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (releaseRes.error) throw releaseRes.error;

      const current = ((releaseRes.data ?? []) as Array<{
        id: string;
        window_start: string;
        window_end: string;
        is_active: boolean;
      }>).find((r) => r.window_start <= todayIso && r.window_end >= todayIso);

      setActiveRelease(
        current
          ? {
              id: current.id,
              window_start: current.window_start,
              window_end: current.window_end,
            }
          : null
      );
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Erro ao carregar mapa comportamental.";
      setMsg(
        `Erro ao carregar mapa comportamental: ${text}. Rode supabase/sql/2026-03-04_create_behavior_assessment_module.sql.`
      );
      setHistory([]);
      setActiveRelease(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAssessment() {
    if (!userId) return;
    if (!canPerformAssessment) {
      setMsg("A avaliacao comportamental nao esta liberada para voce neste momento. Solicite ao RH.");
      return;
    }
    if (!selfSelected.length || !othersSelected.length) {
      setMsg("Selecione adjetivos nas etapas 2 e 3 para registrar o mapa.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        user_id: userId,
        full_name: fullName.trim() || "Colaborador",
        email: email.trim() || "sem-email@local",
        self_selected_ids: selfSelected,
        others_selected_ids: othersSelected,
        self_result: selfResults,
        others_result: othersResults,
        predominant_self: predominantSelf.map((item) => item.key),
        predominant_others: predominantOthers.map((item) => item.key),
      };
      const { error } = await supabase.from("behavior_assessments").insert(payload);
      if (error) throw error;

      setMsg("Mapa comportamental registrado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar mapa comportamental.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Mapa comportamental</h1>
            <p className="mt-1 text-sm text-slate-600">
              Perfis predominantes e complementares com base em adjetivos selecionados nas etapas de auto percepcao e exigencia do meio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep(2);
              setSelfSelected([]);
              setOthersSelected([]);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <RefreshCcw size={16} />
            Reiniciar
          </button>
        </div>
      </div>

      {activeRelease ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Janela ativa:{" "}
          <b>{new Date(`${activeRelease.window_start}T00:00:00`).toLocaleDateString("pt-BR")}</b> ate{" "}
          <b>{new Date(`${activeRelease.window_end}T00:00:00`).toLocaleDateString("pt-BR")}</b>.
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A avaliacao comportamental ainda nao foi liberada pelo RH para o periodo atual.
        </div>
      )}

      {!activeRelease ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Assim que o RH liberar a avaliacao dentro de uma janela ativa, as informacoes do mapa comportamental serao exibidas aqui.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Mapas registrados</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{history.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Etapa atual</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{step - 1}/2</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Selecionados (total)</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {selfSelected.length + othersSelected.length}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canGoStep2 || !canPerformAssessment}
                className={cx(
                  "rounded-xl border px-4 py-3 text-left text-sm disabled:opacity-60",
                  step === 2 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                )}
              >
                <p className="font-semibold">1. Como eu sou</p>
                <p className={cx("mt-1 text-xs", step === 2 ? "text-slate-200" : "text-slate-500")}>
                  Adjetivos que melhor te representam
                </p>
              </button>
              <button
                type="button"
                onClick={() => canGoStep3 && setStep(3)}
                disabled={!canGoStep3 || !canPerformAssessment}
                className={cx(
                  "rounded-xl border px-4 py-3 text-left text-sm disabled:opacity-60",
                  step === 3 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                )}
              >
                <p className="font-semibold">2. Como o meio me percebe</p>
                <p className={cx("mt-1 text-xs", step === 3 ? "text-slate-200" : "text-slate-500")}>
                  Como os outros esperam que voce seja
                </p>
              </button>
            </div>
          </div>

          {step === 2 || step === 3 ? (
            <section className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {step === 2
                      ? "Marque os adjetivos que melhor te representam"
                      : "Agora marque como os outros pensam que voce deveria ser"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Nao existem respostas certas. O objetivo e identificar predominancia relativa entre os perfis.
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 2xl:grid-cols-10">
                  {BEHAVIOR_ADJECTIVES.map((item) => {
                    const selected = step === 2
                      ? selfSelected.includes(item.id)
                      : othersSelected.includes(item.id);

                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() =>
                          !canPerformAssessment
                            ? null
                            :
                            step === 2
                              ? setSelfSelected((prev) => toggle(prev, item.id))
                              : setOthersSelected((prev) => toggle(prev, item.id))
                        }
                        disabled={!canPerformAssessment}
                        className={cx(
                          "flex min-h-[56px] items-center justify-center rounded-xl border px-2 py-2 text-center text-[15px] font-medium leading-snug transition",
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <span className="break-words">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Selecionados nesta etapa:{" "}
                  <b>{step === 2 ? selfSelected.length : othersSelected.length}</b>
                </p>

                <div className="mt-4 flex justify-end">
                  <div className="flex gap-2">
                    {step === 2 ? (
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        disabled={!canGoStep3 || !canPerformAssessment}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                      >
                        Ir para etapa 3
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Voltar etapa 2
                      </button>
                    )}
                  </div>
                </div>
              </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ResultCard
              title="Perfil natural (como eu sou)"
              icon={<User2 size={16} />}
              personName={personName}
              selectedCount={selfSelected.length}
              results={selfResults}
              predominant={predominantSelf}
              attentionCount={selfAttentionCount}
            />
            <ResultCard
              title="Exigencia percebida (como os outros esperam)"
              icon={<Users size={16} />}
              personName={personName}
              selectedCount={othersSelected.length}
              results={othersResults}
              predominant={predominantOthers}
              attentionCount={othersAttentionCount}
            />
          </div>
          <ResultCard
            title="Perfil consolidado (leitura complementar)"
            icon={<Layers3 size={16} />}
            personName={personName}
            selectedCount={selfSelected.length + othersSelected.length}
            results={consolidatedResults}
            predominant={predominantConsolidated}
            attentionCount={selfAttentionCount + othersAttentionCount}
            helperText="Consolidado calculado com 70% do perfil natural e 30% da exigencia percebida. Use como leitura complementar, sem substituir Q1 e Q2."
          />
          <FactorCard
            title="Fatores positivos e negativos por perfil"
            helperText="Leitura derivada de Q2: adjetivos de atencao entram como fator negativo e os demais como fator positivo. E um modelo interno do portal para analise complementar."
            results={othersFactorResults}
          />
          <IsolatedProfileCard
            title="Perfil isolado"
            helperText="Leitura derivada para comparar perfil atual, exigencia do meio e forca de adaptacao nos quatro perfis comportamentais. E um modelo interno do portal para analise complementar."
            points={isolatedProfile}
          />
          <LeadershipCard
            title="Estilo de lideranca x lideranca atual"
            helperText="Leitura derivada para comparar tendencia natural, exigencia do meio e adaptacao nos eixos de dominancia, informalidade, condescendencia e formalidade."
            points={leadershipProfile}
          />
          <CompetencyRadarCard
            title="Grafico de competencias"
            helperText="Radar derivado do consolidado, fatores e estilo de lideranca. E uma leitura complementar do portal, ainda em calibracao frente aos relatorios externos."
            points={competencyProfile}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveAssessment()}
              disabled={
                saving ||
                loading ||
                !userId ||
                !canPerformAssessment ||
                !selfSelected.length ||
                !othersSelected.length
              }
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {saving ? "Registrando..." : "Registrar mapa comportamental"}
            </button>
          </div>
            </section>
          ) : null}
        </>
      )}

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
      ) : null}

      {activeRelease ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Historico recente</p>
          <div className="mt-3 space-y-3">
            {history.length ? (
              history.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <span className="text-xs text-slate-500">
                      Perfis predominantes (auto):{" "}
                      {item.predominant_self?.length
                        ? item.predominant_self
                            .map((key) => BEHAVIOR_AXIS_META[key as keyof typeof BEHAVIOR_AXIS_META]?.label ?? key)
                            .join(", ")
                        : "-"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Perfis predominantes (meio):{" "}
                    {item.predominant_others?.length
                      ? item.predominant_others
                          .map((key) => BEHAVIOR_AXIS_META[key as keyof typeof BEHAVIOR_AXIS_META]?.label ?? key)
                          .join(", ")
                      : "-"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
                Nenhum mapa comportamental registrado.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function LeadershipCard({
  title,
  helperText,
  points,
}: {
  title: string;
  helperText: string;
  points: BehaviorLeadershipPoint[];
}) {
  return <TrendComparisonCard title={title} helperText={helperText} points={points} />;
}

function CompetencyRadarCard({
  title,
  helperText,
  points,
}: {
  title: string;
  helperText: string;
  points: BehaviorCompetencyPoint[];
}) {
  const width = 760;
  const height = 760;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = 250;
  const levels = 5;
  const angleStep = (Math.PI * 2) / points.length;
  const scoreToRadius = (score: number) => (score / 10) * maxRadius;
  const polar = (radius: number, angle: number) => ({
    x: centerX + radius * Math.cos(angle - Math.PI / 2),
    y: centerY + radius * Math.sin(angle - Math.PI / 2),
  });
  const polygonPoints = points
    .map((item, index) => {
      const point = polar(scoreToRadius(item.score), index * angleStep);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{helperText}</p>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px]">
          {Array.from({ length: levels }, (_, levelIndex) => {
            const radius = ((levelIndex + 1) / levels) * maxRadius;
            const ring = points
              .map((_, index) => {
                const point = polar(radius, index * angleStep);
                return `${point.x},${point.y}`;
              })
              .join(" ");
            return <polygon key={radius} points={ring} fill="none" stroke="#e2e8f0" strokeWidth="1" />;
          })}

          {points.map((item, index) => {
            const outer = polar(maxRadius + 24, index * angleStep);
            const axis = polar(maxRadius, index * angleStep);
            return (
              <g key={item.order}>
                <line x1={centerX} y1={centerY} x2={axis.x} y2={axis.y} stroke="#e2e8f0" strokeWidth="1" />
                <text
                  x={outer.x}
                  y={outer.y}
                  textAnchor={outer.x >= centerX + 8 ? "start" : outer.x <= centerX - 8 ? "end" : "middle"}
                  fontSize="11"
                  fill="#475569"
                >
                  {item.order}. {item.label}
                </text>
              </g>
            );
          })}

          <polygon points={polygonPoints} fill="rgba(124,58,237,0.25)" stroke="#7c3aed" strokeWidth="2.5" />
          {points.map((item, index) => {
            const point = polar(scoreToRadius(item.score), index * angleStep);
            return <circle key={item.order} cx={point.x} cy={point.y} r="4" fill="#7c3aed" />;
          })}
        </svg>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {points.map((item) => (
          <div key={item.order} className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{item.order}. {item.label}</span>
            <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
              {item.score.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IsolatedProfileCard({
  title,
  helperText,
  points,
}: {
  title: string;
  helperText: string;
  points: BehaviorIsolatedProfilePoint[];
}) {
  return <TrendComparisonCard title={title} helperText={helperText} points={points} />;
}

function TrendComparisonCard({
  title,
  helperText,
  points,
}: {
  title: string;
  helperText: string;
  points: Array<{
    key: string;
    label: string;
    profileCurrent: number;
    environmentDemand: number;
    adaptationStrength: number;
  }>;
}) {
  const width = 820;
  const height = 260;
  const margin = { top: 28, right: 24, bottom: 44, left: 24 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxAbs = 20;
  const centerY = margin.top + innerHeight / 2;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth;

  const valueToY = (value: number) => centerY - (value / maxAbs) * (innerHeight / 2);
  const pointX = (index: number) => margin.left + stepX * index;
  const toPolyline = (values: number[]) =>
    values.map((value, index) => `${pointX(index)},${valueToY(value)}`).join(" ");

  const currentLine = toPolyline(points.map((item) => item.profileCurrent));
  const demandLine = toPolyline(points.map((item) => item.environmentDemand));
  const adaptationLine = toPolyline(points.map((item) => item.adaptationStrength));
  const tickValues = [-20, -10, 0, 10, 20];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{helperText}</p>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px]">
          {tickValues.map((tick) => {
            const y = valueToY(tick);
            return (
              <g key={tick}>
                <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={4} y={y + 4} fontSize="11" fill="#64748b">
                  {tick}
                </text>
              </g>
            );
          })}

          {points.map((item, index) => {
            const x = pointX(index);
            return (
              <g key={item.key}>
                <line x1={x} y1={margin.top} x2={x} y2={height - margin.bottom} stroke="#f1f5f9" strokeWidth="1" />
                <text x={x} y={height - 16} textAnchor="middle" fontSize="12" fill="#334155">
                  {item.label}
                </text>
              </g>
            );
          })}

          <polyline fill="none" stroke="#7c3aed" strokeWidth="2.5" points={currentLine} />
          <polyline fill="none" stroke="#e11d48" strokeWidth="2.5" points={demandLine} />
          <polyline fill="none" stroke="#111827" strokeWidth="2.5" points={adaptationLine} />

          {points.map((item, index) => {
            const x = pointX(index);
            return (
              <g key={`${item.key}-dots`}>
                <circle cx={x} cy={valueToY(item.profileCurrent)} r="5" fill="#7c3aed" />
                <rect x={x - 5} y={valueToY(item.environmentDemand) - 5} width="10" height="10" rx="2" fill="#e11d48" />
                <path d={`M ${x} ${valueToY(item.adaptationStrength) - 6} L ${x - 6} ${valueToY(item.adaptationStrength) + 5} L ${x + 6} ${valueToY(item.adaptationStrength) + 5} Z`} fill="#111827" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
          Perfil atual
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" />
          Exigencia do meio
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0 w-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-slate-900" />
          Forca de adaptacao
        </span>
      </div>
    </div>
  );
}

function FactorCard({
  title,
  helperText,
  results,
}: {
  title: string;
  helperText: string;
  results: BehaviorFactorResult[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{helperText}</p>

      <div className="mt-4 space-y-4">
        {results.map((item) => (
          <div key={item.key} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">{item.label}</span>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="text-emerald-700">+{item.positivePercent.toFixed(1)}%</span>
                <span className="text-rose-700">-{item.negativePercent.toFixed(1)}%</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_1fr] items-center gap-3">
              <div>
                <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
                  <div
                    className={cx("h-full rounded-full", BEHAVIOR_AXIS_META[item.key].colorClass)}
                    style={{ width: `${Math.min(item.positivePercent, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Fator positivo</p>
              </div>
              <div>
                <div className="h-3 overflow-hidden rounded-full bg-rose-100">
                  <div
                    className="h-full rounded-full bg-rose-400"
                    style={{ width: `${Math.min(item.negativePercent, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Fator negativo</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({
  title,
  icon,
  personName,
  selectedCount,
  results,
  predominant,
  attentionCount,
  helperText,
}: {
  title: string;
  icon: ReactNode;
  personName: string;
  selectedCount: number;
  results: BehaviorAxisResult[];
  predominant: BehaviorAxisResult[];
  attentionCount: number;
  helperText?: string;
}) {
  const confidence = getBehaviorConfidence(selectedCount);
  const confidenceChipClass =
    confidence.level === "alta"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : confidence.level === "media"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-xs text-slate-500">{getBehaviorSummaryLine(results, personName)}</p>
      {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
      <p className="mt-1 text-xs text-slate-500">
        Itens selecionados: <b>{selectedCount}</b>
      </p>
      <span className={cx("mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold", confidenceChipClass)}>
        {confidence.label}
      </span>
      <p className="mt-1 text-xs text-slate-500">{confidence.description}</p>

      {attentionCount > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {attentionCount} adjetivo(s) de atencao selecionado(s). Isso nao e julgamento de valor, apenas um indicativo para leitura contextual.
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {results.map((item) => (
          <div key={item.key} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{item.label}</span>
              <span
                className={cx(
                  "inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold",
                  BEHAVIOR_AXIS_META[item.key].chipClass
                )}
              >
                {item.percent.toFixed(2)}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div
                className={cx("h-2 rounded-full", BEHAVIOR_AXIS_META[item.key].colorClass)}
                style={{ width: `${Math.min(item.percent, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {getBehaviorClassificationLabel(item.classification)} ·{" "}
              {item.isPredominant ? "Perfil predominante" : "Perfil complementar"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Leitura de predominancia</p>
        {predominant.length ? (
          <p className="mt-1">
            Perfis predominantes:{" "}
            <b>{predominant.map((p) => p.label).join(", ")}</b>
            .
          </p>
        ) : (
          <p className="mt-1">
            Nenhum perfil atingiu 25%. Neste caso, a composicao esta mais equilibrada entre os quatro eixos.
          </p>
        )}
      </div>
    </div>
  );
}
