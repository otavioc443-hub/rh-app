"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCcw, User2, Users } from "lucide-react";
import {
  BEHAVIOR_ADJECTIVES,
  BEHAVIOR_AXIS_META,
  calculateBehaviorAxisResults,
  getBehaviorConfidence,
  getBehaviorAttentionCount,
  getBehaviorClassificationLabel,
  getBehaviorSummaryLine,
  getPredominantBehaviorAxes,
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

  const predominantSelf = useMemo(() => getPredominantBehaviorAxes(selfResults), [selfResults]);
  const predominantOthers = useMemo(() => getPredominantBehaviorAxes(othersResults), [othersResults]);

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

function ResultCard({
  title,
  icon,
  personName,
  selectedCount,
  results,
  predominant,
  attentionCount,
}: {
  title: string;
  icon: ReactNode;
  personName: string;
  selectedCount: number;
  results: BehaviorAxisResult[];
  predominant: BehaviorAxisResult[];
  attentionCount: number;
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
