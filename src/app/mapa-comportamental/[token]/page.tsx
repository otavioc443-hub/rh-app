"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Layers3 } from "lucide-react";
import { useParams } from "next/navigation";
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
  getBehaviorClassificationLabel,
  getBehaviorSummaryLine,
  getPredominantBehaviorAxes,
  type BehaviorCompetencyPoint,
  type BehaviorFactorResult,
  type BehaviorIsolatedProfilePoint,
  type BehaviorLeadershipPoint,
  type BehaviorAxisResult,
} from "@/lib/behaviorProfile";

type Step = 2 | 3;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
}

export default function PublicBehaviorMapPage({
}: Record<string, never>) {
  const params = useParams<{ token: string }>();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [step, setStep] = useState<Step>(2);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<
    "pending" | "completed" | "expired" | "cancelled" | null
  >(null);
  const [selfSelected, setSelfSelected] = useState<string[]>([]);
  const [othersSelected, setOthersSelected] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const token = params?.token ?? "";
      if (!token) {
        setMsg("Token invalido.");
        setLoading(false);
        return;
      }
      if (!mounted) return;
      setToken(token);

      try {
        const res = await fetch(`/api/behavior/invite/${token}`, {
          method: "GET",
          cache: "no-store",
        });
        const json = (await res.json()) as {
          error?: string;
          invite?: { email: string; status: "pending" | "completed" | "expired" | "cancelled" };
          collaboratorName?: string | null;
        };
        if (!res.ok) throw new Error(json.error ?? "Convite invalido.");

        setEmail(json.invite?.email ?? "");
        setFullName(json.collaboratorName ?? "");
        setInviteStatus(json.invite?.status ?? null);
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Erro ao carregar convite.");
      } finally {
        setLoading(false);
      }
    }
    void boot();
    return () => {
      mounted = false;
    };
  }, [params]);

  const selfResults = useMemo(() => calculateBehaviorAxisResults(selfSelected), [selfSelected]);
  const othersResults = useMemo(() => calculateBehaviorAxisResults(othersSelected), [othersSelected]);
  const consolidatedResults = useMemo(
    () => combineBehaviorAxisResults(selfResults, othersResults, 0.7),
    [selfResults, othersResults]
  );
  const factorResults = useMemo(() => calculateBehaviorFactorResults(othersSelected), [othersSelected]);
  const isolatedProfile = useMemo(
    () => calculateBehaviorIsolatedProfile(selfResults, othersResults),
    [selfResults, othersResults]
  );
  const leadershipProfile = useMemo(
    () => calculateBehaviorLeadershipProfile(selfResults, othersResults),
    [selfResults, othersResults]
  );
  const competencyProfile = useMemo(
    () => calculateBehaviorCompetencies(consolidatedResults, factorResults, leadershipProfile),
    [consolidatedResults, factorResults, leadershipProfile]
  );

  const sortedSelf = useMemo(
    () => [...selfResults].sort((a, b) => b.percent - a.percent),
    [selfResults]
  );
  const sortedOthers = useMemo(
    () => [...othersResults].sort((a, b) => b.percent - a.percent),
    [othersResults]
  );
  const sortedConsolidated = useMemo(
    () => [...consolidatedResults].sort((a, b) => b.percent - a.percent),
    [consolidatedResults]
  );

  async function submit() {
    if (!token) return;
    if (!selfSelected.length || !othersSelected.length) {
      setMsg("Selecione adjetivos nas etapas 2 e 3.");
      return;
    }

    setSubmitting(true);
    setMsg("");
    try {
      const res = await fetch("/api/behavior/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fullName: fullName.trim() || "Colaborador",
          email: email.trim() || "sem-email@local",
          selfSelectedIds: selfSelected,
          othersSelectedIds: othersSelected,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar respostas.");
      setInviteStatus("completed");
      setMsg("Questionario enviado com sucesso.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar questionario.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-700">
          Carregando convite...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Mapa comportamental</h1>
          <p className="mt-1 text-sm text-slate-600">
            Responda com autenticidade. O resultado indica perfis predominantes e complementares no momento desta avaliacao.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Status do convite: <b>{inviteStatus ?? "indefinido"}</b>
          </p>
        </div>

        {inviteStatus !== "pending" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Este convite nao esta disponivel para resposta.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={cx(
                    "rounded-xl border px-4 py-3 text-left text-sm",
                    step === 2 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  1. Como eu sou
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={cx(
                    "rounded-xl border px-4 py-3 text-left text-sm",
                    step === 3 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  2. Como o meio me percebe
                </button>
              </div>
            </div>

            <section className="space-y-4">
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
                      const selected =
                        step === 2
                          ? selfSelected.includes(item.id)
                          : othersSelected.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            step === 2
                              ? setSelfSelected((prev) => toggle(prev, item.id))
                              : setOthersSelected((prev) => toggle(prev, item.id))
                          }
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
                    {step === 2 ? (
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        disabled={!selfSelected.length}
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

                <div className="grid gap-4 xl:grid-cols-2">
                  <SimpleResultCard
                    title="Perfil natural (como eu sou)"
                    personName={fullName || "O colaborador"}
                    selectedCount={selfSelected.length}
                    results={sortedSelf}
                  />
                  <SimpleResultCard
                    title="Exigencia percebida (como os outros esperam)"
                    personName={fullName || "O colaborador"}
                    selectedCount={othersSelected.length}
                    results={sortedOthers}
                  />
                </div>
                <SimpleResultCard
                  title="Perfil consolidado (leitura complementar)"
                  personName={fullName || "O colaborador"}
                  selectedCount={selfSelected.length + othersSelected.length}
                  helperText="Consolidado com 70% de Q1 e 30% de Q2. Use como leitura complementar."
                  icon={<Layers3 size={16} />}
                  results={sortedConsolidated}
                />
                <FactorCard
                  title="Fatores positivos e negativos por perfil"
                  helperText="Leitura derivada de Q2 para analise complementar."
                  results={factorResults}
                />
                <TrendComparisonCard
                  title="Perfil isolado"
                  helperText="Comparativo entre perfil atual, exigencia do meio e forca de adaptacao."
                  points={isolatedProfile}
                />
                <TrendComparisonCard
                  title="Estilo de lideranca x lideranca atual"
                  helperText="Comparativo derivado dos eixos de dominancia, informalidade, condescendencia e formalidade."
                  points={leadershipProfile}
                />
                <CompetencyRadarCard
                  title="Grafico de competencias"
                  helperText="Radar derivado do consolidado, fatores e estilo de lideranca."
                  points={competencyProfile}
                />
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={
                  submitting ||
                  !selfSelected.length ||
                  !othersSelected.length
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                <CheckCircle2 size={16} />
                {submitting ? "Enviando..." : "Enviar respostas"}
              </button>
            </div>
          </>
        )}

        {msg ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
        ) : null}
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
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendComparisonCard({
  title,
  helperText,
  points,
}: {
  title: string;
  helperText: string;
  points: Array<BehaviorIsolatedProfilePoint | BehaviorLeadershipPoint>;
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
  const toPolyline = (values: number[]) => values.map((value, index) => `${pointX(index)},${valueToY(value)}`).join(" ");
  const currentLine = toPolyline(points.map((item) => item.profileCurrent));
  const demandLine = toPolyline(points.map((item) => item.environmentDemand));
  const adaptationLine = toPolyline(points.map((item) => item.adaptationStrength));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{helperText}</p>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px]">
          <polyline fill="none" stroke="#7c3aed" strokeWidth="2.5" points={currentLine} />
          <polyline fill="none" stroke="#e11d48" strokeWidth="2.5" points={demandLine} />
          <polyline fill="none" stroke="#111827" strokeWidth="2.5" points={adaptationLine} />
          {points.map((item, index) => {
            const x = pointX(index);
            return (
              <text key={item.key} x={x} y={height - 16} textAnchor="middle" fontSize="12" fill="#334155">
                {item.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
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
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{helperText}</p>
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

function SimpleResultCard({
  title,
  personName,
  selectedCount,
  helperText,
  icon,
  results,
}: {
  title: string;
  personName: string;
  selectedCount: number;
  helperText?: string;
  icon?: ReactNode;
  results: BehaviorAxisResult[];
}) {
  const predominant = getPredominantBehaviorAxes(results);
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
      <span className={cx("mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold", confidenceChipClass)}>
        {confidence.label}
      </span>
      <p className="mt-1 text-xs text-slate-500">{confidence.description}</p>
      <div className="mt-3 space-y-3">
        {results.map((item) => (
          <div key={item.key} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{item.label}</span>
              <span className="text-xs font-semibold text-slate-700">{item.percent.toFixed(2)}%</span>
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
      <p className="mt-3 text-xs text-slate-700">
        Perfis predominantes:{" "}
        <b>{predominant.length ? predominant.map((p) => p.label).join(", ") : "Nenhum acima de 25%"}</b>
      </p>
    </div>
  );
}
