"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, RefreshCcw, ShieldAlert, User2, Users } from "lucide-react";
import {
  BEHAVIOR_ADJECTIVES,
  BEHAVIOR_AXIS_META,
  calculateBehaviorCompetencies,
  calculateBehaviorFactorResults,
  calculateBehaviorIsolatedProfile,
  calculateBehaviorLeadershipProfile,
  combineBehaviorAxisResults,
  getBehaviorClassificationLabel,
  getBehaviorConfidence,
  getBehaviorSummaryLine,
  getPredominantBehaviorAxes,
  type BehaviorAxisResult,
  type BehaviorCompetencyPoint,
  type BehaviorFactorResult,
  type BehaviorIsolatedProfilePoint,
  type BehaviorLeadershipPoint,
} from "@/lib/behaviorProfile";

type Step = 2 | 3;

type BehaviorHistoryItem = {
  id: string;
  created_at: string;
  predominant_self: string[] | null;
  predominant_others: string[] | null;
  self_result: BehaviorAxisResult[];
  others_result: BehaviorAxisResult[];
  self_selected_ids: string[] | null;
  others_selected_ids: string[] | null;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

function sortResults(results: BehaviorAxisResult[]) {
  return [...results].sort((a, b) => b.percent - a.percent || b.score - a.score);
}

function normalizeDisplayName(value: string | null | undefined) {
  const name = String(value ?? "").trim();
  if (!name || name.includes("@")) return null;
  return name;
}

function firstName(value: string | null | undefined) {
  const normalized = normalizeDisplayName(value);
  if (!normalized) return null;
  return normalized.split(/\s+/)[0] ?? null;
}

function summarizePredominance(predominant: BehaviorAxisResult[]) {
  if (!predominant.length) return "Perfil equilibrado";
  return predominant.map((item) => item.label).join(" + ");
}

function signedValue(value: number) {
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}` : rounded;
}

function buildFactorAttention(selfFactors: BehaviorFactorResult[], othersFactors: BehaviorFactorResult[]) {
  const items: string[] = [];
  const selfCritical = [...selfFactors].sort((a, b) => b.negativePercent - a.negativePercent).slice(0, 2);
  const envCritical = [...othersFactors].sort((a, b) => b.negativePercent - a.negativePercent).slice(0, 2);

  for (const item of selfCritical) {
    if (item.negativePercent > 0) {
      items.push(`${item.label}: ${item.negativePercent.toFixed(2)}% de fatores de atencao no perfil natural.`);
    }
  }
  for (const item of envCritical) {
    if (item.negativePercent > 0) {
      items.push(`${item.label}: ${item.negativePercent.toFixed(2)}% de tensao percebida na exigencia do meio.`);
    }
  }

  return items.length
    ? items
    : ["Nao foram identificados fatores de atencao relevantes nas selecoes atuais."];
}

function buildBehaviorRecommendations(
  personName: string,
  predominantSelf: BehaviorAxisResult[],
  predominantOthers: BehaviorAxisResult[],
  dominantGaps: BehaviorIsolatedProfilePoint[],
  mainCompetencies: BehaviorCompetencyPoint[]
) {
  const topSelf = predominantSelf[0]?.label ?? "Perfil equilibrado";
  const topEnvironment = predominantOthers[0]?.label ?? "ambiente equilibrado";
  const gap = dominantGaps[0];
  const competenciesText = mainCompetencies.slice(0, 3).map((item) => item.label).join(", ");

  return [
    {
      title: "Usar a predominancia natural com intencao",
      text: `${personName} tende a operar com maior naturalidade em ${topSelf}. Vale priorizar contextos e entregas em que esse estilo apareca como forca principal, sem perder abertura para ajuste situacional.`,
    },
    {
      title: "Adaptacao ao contexto atual",
      text: `O ambiente hoje puxa mais para ${topEnvironment}. Isso sugere calibrar comunicacao, ritmo e forma de decisao para reduzir desgaste sem descaracterizar o perfil natural.`,
    },
    {
      title: "Foco de desenvolvimento",
      text: gap
        ? `A maior diferenca aparece em ${gap.label}. Um plano simples e pratico e observar esse eixo nas proximas semanas e testar pequenas adaptacoes na rotina e na interacao com o time.`
        : "O perfil esta relativamente equilibrado. O proximo passo mais util e manter consistencia nas entregas e observar variacoes ao longo do tempo.",
    },
    {
      title: "Competencias a explorar",
      text: `As competencias com maior potencial nesta leitura sao: ${competenciesText}. Vale usar isso como base para PDI, conversas com gestor e definicao de responsabilidades.`,
    },
  ];
}

export default function MapaComportamentalPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<BehaviorHistoryItem[]>([]);
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

  const personName = firstName(fullName) ?? "O colaborador";
  const canPerformAssessment = !!activeRelease;
  const latestAssessment = history[0] ?? null;
  const reportSelfResults = sortResults(latestAssessment?.self_result ?? []);
  const reportOthersResults = sortResults(latestAssessment?.others_result ?? []);
  const reportPredominantSelf = getPredominantBehaviorAxes(reportSelfResults);
  const reportPredominantOthers = getPredominantBehaviorAxes(reportOthersResults);
  const reportSelfSelectedIds = latestAssessment?.self_selected_ids ?? [];
  const reportOthersSelectedIds = latestAssessment?.others_selected_ids ?? [];

  const selfFactors = useMemo(
    () => calculateBehaviorFactorResults(reportSelfSelectedIds),
    [reportSelfSelectedIds]
  );
  const othersFactors = useMemo(
    () => calculateBehaviorFactorResults(reportOthersSelectedIds),
    [reportOthersSelectedIds]
  );
  const isolatedProfile = useMemo(
    () => calculateBehaviorIsolatedProfile(reportSelfResults, reportOthersResults),
    [reportSelfResults, reportOthersResults]
  );
  const leadershipProfile = useMemo(
    () => calculateBehaviorLeadershipProfile(reportSelfResults, reportOthersResults),
    [reportSelfResults, reportOthersResults]
  );
  const consolidatedResults = useMemo(
    () => combineBehaviorAxisResults(reportSelfResults, reportOthersResults),
    [reportSelfResults, reportOthersResults]
  );
  const competencies = useMemo(
    () => calculateBehaviorCompetencies(consolidatedResults, selfFactors, leadershipProfile),
    [consolidatedResults, selfFactors, leadershipProfile]
  );
  const selfConfidence = useMemo(
    () => getBehaviorConfidence(reportSelfSelectedIds.length),
    [reportSelfSelectedIds.length]
  );
  const othersConfidence = useMemo(
    () => getBehaviorConfidence(reportOthersSelectedIds.length),
    [reportOthersSelectedIds.length]
  );
  const dominantGaps = useMemo(
    () =>
      [...isolatedProfile]
        .sort((a, b) => Math.abs(b.environmentDemand - b.profileCurrent) - Math.abs(a.environmentDemand - a.profileCurrent))
        .slice(0, 2),
    [isolatedProfile]
  );
  const mainCompetencies = useMemo(
    () => [...competencies].sort((a, b) => b.score - a.score).slice(0, 6),
    [competencies]
  );
  const recommendations = useMemo(
    () =>
      buildBehaviorRecommendations(
        personName,
        reportPredominantSelf,
        reportPredominantOthers,
        dominantGaps,
        mainCompetencies
      ),
    [personName, reportPredominantSelf, reportPredominantOthers, dominantGaps, mainCompetencies]
  );

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/behavior/me", {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json()) as {
        error?: string;
        userId?: string;
        fullName?: string;
        email?: string;
        activeRelease?: { id: string; window_start: string; window_end: string } | null;
        history?: BehaviorHistoryItem[];
      };

      if (!res.ok) {
        throw new Error(body.error || "Erro ao carregar mapa comportamental.");
      }

      setUserId(body.userId ?? null);
      setFullName((prev) => normalizeDisplayName(prev) ?? normalizeDisplayName(body.fullName) ?? "");
      setEmail((prev) => prev || body.email || "");
      setHistory(body.history ?? []);
      setActiveRelease(body.activeRelease ?? null);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Erro ao carregar mapa comportamental.";
      setMsg(`Erro ao carregar mapa comportamental: ${text}. Rode supabase/sql/2026-03-04_create_behavior_assessment_module.sql.`);
      setHistory([]);
      setActiveRelease(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
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
        full_name: fullName.trim() || "Colaborador",
        email: email.trim() || "sem-email@local",
        selfSelectedIds: selfSelected,
        othersSelectedIds: othersSelected,
      };

      const res = await fetch("/api/behavior/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(body.error || "Erro ao registrar mapa comportamental.");
      }

      setMsg("Mapa comportamental registrado com sucesso.");
      await load();
      setStep(2);
      setSelfSelected([]);
      setOthersSelected([]);
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Erro ao registrar mapa comportamental.");
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
              Relatorio completo com perfil natural, exigencia do meio, competencias, estilo de lideranca e recomendacoes praticas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {latestAssessment ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                <Download size={16} />
                Exportar em PDF
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setStep(2);
                setSelfSelected([]);
                setOthersSelected([]);
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Reiniciar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-5 w-52 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {canPerformAssessment ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Janela ativa:{" "}
              <b>
                {new Date(activeRelease.window_start).toLocaleDateString("pt-BR")} ate{" "}
                {new Date(activeRelease.window_end).toLocaleDateString("pt-BR")}
              </b>
              .
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                A avaliacao comportamental ainda nao foi liberada pelo RH para o periodo atual.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                Assim que o RH liberar a avaliacao dentro de uma janela ativa, o relatorio sera exibido aqui.
              </div>
            </>
          )}

          {latestAssessment ? (
            <section className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-4">
                <SummaryTile
                  title="Visao geral do perfil"
                  value={summarizePredominance(reportPredominantSelf)}
                  description={getBehaviorSummaryLine(reportSelfResults, personName)}
                />
                <SummaryTile
                  title="Exigencia do meio"
                  value={summarizePredominance(reportPredominantOthers)}
                  description={getBehaviorSummaryLine(reportOthersResults, personName)}
                />
                <SummaryTile
                  title="Confianca do perfil natural"
                  value={selfConfidence.label}
                  description={`${reportSelfSelectedIds.length} adjetivos selecionados.`}
                />
                <SummaryTile
                  title="Confianca da exigencia do meio"
                  value={othersConfidence.label}
                  description={`${reportOthersSelectedIds.length} adjetivos selecionados.`}
                />
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Resultado atual</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Ultimo mapa registrado em {new Date(latestAssessment.created_at).toLocaleDateString("pt-BR")}.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <ResultCard
                    title="Perfil natural"
                    icon={<User2 size={16} />}
                    personName={personName}
                    results={reportSelfResults}
                    predominant={reportPredominantSelf}
                  />
                  <ResultCard
                    title="Exigencia do meio"
                    icon={<Users size={16} />}
                    personName={personName}
                    results={reportOthersResults}
                    predominant={reportPredominantOthers}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <SectionHeader
                  title="Perfil natural x exigencia do meio"
                  description="Leitura da adaptacao entre a forma natural de atuar e o que o ambiente atual demanda."
                />
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {isolatedProfile.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <MetricRow label="Perfil atual" value={signedValue(item.profileCurrent)} />
                        <MetricRow label="Exigencia do meio" value={signedValue(item.environmentDemand)} />
                        <MetricRow label="Adaptacao" value={signedValue(item.adaptationStrength)} strong />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <SectionHeader
                  title="Competencias comportamentais"
                  description="Estimativa das competencias mais favorecidas a partir do perfil consolidado."
                />
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {mainCompetencies.map((item) => (
                    <CompetencyBar key={item.label} point={item} />
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <SectionHeader
                  title="Pontos de atencao"
                  description="Friccoes mais provaveis entre perfil atual e exigencia do meio, com sinais de alerta para acompanhamento."
                />
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <AttentionPanel
                    title="Principais desvios de adaptacao"
                    items={dominantGaps.map((item) => `${item.label}: diferenca de ${Math.abs(item.environmentDemand - item.profileCurrent).toFixed(2)} pontos entre perfil atual e demanda do meio.`)}
                  />
                  <AttentionPanel
                    title="Fatores de observacao"
                    items={buildFactorAttention(selfFactors, othersFactors)}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <SectionHeader
                  title="Estilo de lideranca"
                  description="Leitura sintetica do estilo de conducao mais provavel, considerando perfil e contexto."
                />
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {leadershipProfile.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-lg font-semibold text-slate-950">{item.label}</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <MetricRow label="Natural" value={signedValue(item.profileCurrent)} />
                        <MetricRow label="Ambiente" value={signedValue(item.environmentDemand)} />
                        <MetricRow label="Forca de adaptacao" value={signedValue(item.adaptationStrength)} strong />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <SectionHeader
                  title="Recomendacoes praticas"
                  description="Sugestoes objetivas para usar melhor o perfil no dia a dia e apoiar conversas de desenvolvimento."
                />
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {recommendations.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          ) : null}

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
                  const selected = step === 2 ? selfSelected.includes(item.id) : othersSelected.includes(item.id);

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() =>
                        !canPerformAssessment
                          ? null
                          : step === 2
                            ? setSelfSelected((prev) => toggle(prev, item.id))
                            : setOthersSelected((prev) => toggle(prev, item.id))
                      }
                      disabled={!canPerformAssessment}
                      className={cx(
                        "flex min-h-[56px] items-center justify-center rounded-xl border px-2 py-2 text-center text-[15px] font-medium leading-snug transition",
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        !canPerformAssessment && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <span className="break-words">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Selecionados nesta etapa: <b>{step === 2 ? selfSelected.length : othersSelected.length}</b>
              </p>

              <div className="mt-4 flex justify-end">
                <div className="flex gap-2">
                  {step === 2 ? (
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!selfSelected.length || !canPerformAssessment}
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              O relatorio completo sera exibido apos a conclusao do envio, com os graficos e analises finais.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void saveAssessment()}
                disabled={saving || loading || !userId || !canPerformAssessment || !selfSelected.length || !othersSelected.length}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {saving ? "Registrando..." : "Registrar mapa comportamental"}
              </button>
            </div>
          </section>
        </>
      )}

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
      ) : null}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="text-lg font-semibold text-slate-950">{title}</div>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function SummaryTile({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cx("font-medium text-slate-800", strong && "font-semibold text-slate-950")}>{value}</span>
    </div>
  );
}

function CompetencyBar({ point }: { point: BehaviorCompetencyPoint }) {
  const width = `${Math.min(100, (point.score / 10) * 100)}%`;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">{point.label}</span>
        <span className="text-sm font-semibold text-slate-700">{point.score.toFixed(2)}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-slate-900" style={{ width }} />
      </div>
    </div>
  );
}

function AttentionPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        <ShieldAlert size={16} />
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
            {item}
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
  results,
  predominant,
}: {
  title: string;
  icon: ReactNode;
  personName: string;
  results: BehaviorAxisResult[];
  predominant: BehaviorAxisResult[];
}) {
  const predominantTitle = summarizePredominance(predominant);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] leading-4 text-slate-500">
          Neste momento, {personName} esta:
        </p>
        <p className="mt-2 text-3xl font-semibold leading-none text-slate-950">{predominantTitle}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {results.map((item) => (
          <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-3xl font-semibold leading-none tracking-tight text-slate-950">{item.percent.toFixed(2)}%</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{item.label}</p>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div
                className={cx("h-2 rounded-full", BEHAVIOR_AXIS_META[item.key].colorClass)}
                style={{ width: `${Math.min(item.percent, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] leading-4 text-slate-500">
              {item.isPredominant ? "Perfil predominante" : "Perfil complementar"}
            </p>
            <p className="mt-1 text-xs text-slate-600">{getBehaviorClassificationLabel(item.classification)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Leitura de predominancia</p>
        <p className="mt-1">{getBehaviorSummaryLine(results, personName)}</p>
      </div>
    </div>
  );
}
