"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RefreshCcw, User2, Users } from "lucide-react";
import {
  BEHAVIOR_ADJECTIVES,
  BEHAVIOR_AXIS_META,
  getBehaviorClassificationLabel,
  getBehaviorSummaryLine,
  getPredominantBehaviorAxes,
  type BehaviorAxisResult,
} from "@/lib/behaviorProfile";

type Step = 2 | 3;

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
  return predominant.map((item) => item.label).join(" ");
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

  const personName = firstName(fullName) ?? "O colaborador";
  const canPerformAssessment = !!activeRelease;
  const latestAssessment = history[0] ?? null;
  const reportSelfResults = sortResults(latestAssessment?.self_result ?? []);
  const reportOthersResults = sortResults(latestAssessment?.others_result ?? []);
  const reportPredominantSelf = getPredominantBehaviorAxes(reportSelfResults);
  const reportPredominantOthers = getPredominantBehaviorAxes(reportOthersResults);

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
        history?: Array<{
          id: string;
          created_at: string;
          predominant_self: string[] | null;
          predominant_others: string[] | null;
          self_result: BehaviorAxisResult[];
          others_result: BehaviorAxisResult[];
        }>;
      };

      if (!res.ok) {
        throw new Error(body.error || "Erro ao carregar mapa comportamental.");
      }

      setUserId(body.userId ?? null);
      setFullName(
        (prev) => normalizeDisplayName(prev) ?? normalizeDisplayName(body.fullName) ?? ""
      );
      setEmail((prev) => prev || body.email || "");
      setHistory(body.history ?? []);
      setActiveRelease(body.activeRelease ?? null);
    } catch (error: unknown) {
      const text =
        error instanceof Error ? error.message : "Erro ao carregar mapa comportamental.";
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
  }, []);

  async function saveAssessment() {
    if (!userId) return;

    if (!canPerformAssessment) {
      setMsg("A avaliação comportamental não está liberada para você neste momento. Solicite ao RH.");
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
              Perfis predominantes e complementares com base em adjetivos selecionados nas etapas
              de auto percepção e exigência do meio.
            </p>
          </div>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-100" />
            <div className="mt-6 grid grid-cols-2 gap-2">
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        </>
      ) : (
        <>
          {canPerformAssessment ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Janela ativa:{" "}
              <b>
                {new Date(activeRelease.window_start).toLocaleDateString("pt-BR")} até{" "}
                {new Date(activeRelease.window_end).toLocaleDateString("pt-BR")}
              </b>
              .
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                A avaliação comportamental ainda não foi liberada pelo RH para o período atual.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                Assim que o RH liberar a avaliação dentro de uma janela ativa, as informações do
                mapa comportamental serão exibidas aqui.
              </div>
            </>
          )}

          {latestAssessment ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Resultado atual</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Último mapa registrado em{" "}
                    {new Date(latestAssessment.created_at).toLocaleDateString("pt-BR")}.
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
                  title="Exigência do meio"
                  icon={<Users size={16} />}
                  personName={personName}
                  results={reportOthersResults}
                  predominant={reportPredominantOthers}
                />
              </div>
            </section>
          ) : null}

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {step === 2
                    ? "Marque os adjetivos que melhor te representam"
                    : "Agora marque como os outros pensam que você deveria ser"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Não existem respostas certas. O objetivo é identificar predominância relativa
                  entre os perfis.
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
                Selecionados nesta etapa:{" "}
                <b>{step === 2 ? selfSelected.length : othersSelected.length}</b>
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
              O relatório do mapa comportamental será exibido somente após a conclusão do envio,
              com os gráficos e análises finais.
            </div>

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
        </>
      )}

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {msg}
        </div>
      ) : null}
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
          Neste momento, {personName} está:
        </p>
        <p className="mt-2 text-3xl font-semibold leading-none text-slate-950">
          {predominantTitle}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {results.map((item) => (
          <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p
              className={cx(
                "text-3xl font-semibold leading-none tracking-tight",
                BEHAVIOR_AXIS_META[item.key].textClass
              )}
            >
              {item.percent.toFixed(2)}%
            </p>
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
            <p className="mt-1 text-xs text-slate-600">
              {getBehaviorClassificationLabel(item.classification)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Leitura de predominância</p>
        <p className="mt-1">{getBehaviorSummaryLine(results, personName)}</p>
      </div>
    </div>
  );
}
