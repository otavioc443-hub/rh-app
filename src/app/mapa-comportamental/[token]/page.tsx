"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { useParams } from "next/navigation";
import {
  BEHAVIOR_ADJECTIVES,
  BEHAVIOR_AXIS_META,
  calculateBehaviorAxisResults,
  getBehaviorConfidence,
  getBehaviorClassificationLabel,
  getBehaviorSummaryLine,
  getPredominantBehaviorAxes,
  type BehaviorAxisResult,
} from "@/lib/behaviorProfile";

type Step = 1 | 2 | 3;

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
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<
    "pending" | "completed" | "expired" | "cancelled" | null
  >(null);
  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return BEHAVIOR_ADJECTIVES;
    return BEHAVIOR_ADJECTIVES.filter((item) => item.label.toLowerCase().includes(term));
  }, [search]);

  const selfResults = useMemo(() => calculateBehaviorAxisResults(selfSelected), [selfSelected]);
  const othersResults = useMemo(() => calculateBehaviorAxisResults(othersSelected), [othersSelected]);

  const sortedSelf = useMemo(
    () => [...selfResults].sort((a, b) => b.percent - a.percent),
    [selfResults]
  );
  const sortedOthers = useMemo(
    () => [...othersResults].sort((a, b) => b.percent - a.percent),
    [othersResults]
  );

  async function submit() {
    if (!token) return;
    if (!fullName.trim() || !email.trim()) {
      setMsg("Preencha nome e e-mail.");
      return;
    }
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
          fullName: fullName.trim(),
          email: email.trim(),
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
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={cx(
                    "rounded-xl border px-4 py-3 text-left text-sm",
                    step === 1 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  1. Identificacao
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={cx(
                    "rounded-xl border px-4 py-3 text-left text-sm",
                    step === 2 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  2. Como eu sou
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={cx(
                    "rounded-xl border px-4 py-3 text-left text-sm",
                    step === 3 ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  3. Como o meio me percebe
                </button>
              </div>
            </div>

            {step === 1 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Nome completo
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-300"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    E-mail
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-300"
                      type="email"
                    />
                  </label>
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {step === 2
                      ? "Marque os adjetivos que melhor te representam"
                      : "Marque como os outros esperam que voce seja"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Nao existem respostas certas. O objetivo e identificar predominancia relativa entre os perfis.
                  </p>
                    <div className="flex h-11 w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                      <Search size={15} className="text-slate-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-transparent text-sm text-slate-900 outline-none"
                        placeholder="Buscar adjetivo"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((item) => {
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
                            "rounded-xl border px-3 py-2 text-left text-sm transition",
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Selecionados nesta etapa:{" "}
                    <b>{step === 2 ? selfSelected.length : othersSelected.length}</b>
                  </p>
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
              </section>
            )}

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

function SimpleResultCard({
  title,
  personName,
  selectedCount,
  results,
}: {
  title: string;
  personName: string;
  selectedCount: number;
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
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{getBehaviorSummaryLine(results, personName)}</p>
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
