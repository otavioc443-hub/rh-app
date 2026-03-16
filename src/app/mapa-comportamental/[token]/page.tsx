"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useParams } from "next/navigation";
import { BEHAVIOR_ADJECTIVES } from "@/lib/behaviorProfile";

type Step = 2 | 3;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

export default function PublicBehaviorMapPage() {
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
      const nextToken = params?.token ?? "";
      if (!nextToken) {
        setMsg("Token inválido.");
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setToken(nextToken);

      try {
        const res = await fetch(`/api/behavior/invite/${nextToken}`, {
          method: "GET",
          cache: "no-store",
        });
        const json = (await res.json()) as {
          error?: string;
          invite?: {
            email: string;
            status: "pending" | "completed" | "expired" | "cancelled";
          };
          collaboratorName?: string | null;
        };

        if (!res.ok) {
          throw new Error(json.error ?? "Convite inválido.");
        }

        setEmail(json.invite?.email ?? "");
        setFullName(json.collaboratorName ?? "");
        setInviteStatus(json.invite?.status ?? null);
      } catch (error: unknown) {
        setMsg(error instanceof Error ? error.message : "Erro ao carregar convite.");
      } finally {
        setLoading(false);
      }
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, [params]);

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

      if (!res.ok) {
        throw new Error(json.error ?? "Erro ao enviar questionário.");
      }

      setInviteStatus("completed");
      setMsg("Questionário enviado com sucesso.");
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Erro ao enviar questionário.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
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
            Responda com autenticidade. O resultado indica perfis predominantes e complementares no
            momento desta avaliação.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Status do convite: <b>{inviteStatus ?? "indefinido"}</b>
          </p>
        </div>

        {inviteStatus === "expired" || inviteStatus === "cancelled" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Este convite não está disponível para resposta.
          </div>
        ) : null}

        {inviteStatus === "pending" ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={cx(
                    "rounded-xl border px-4 py-3 text-left text-sm",
                    step === 2
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  1. Como eu sou
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={cx(
                    "rounded-xl border px-4 py-3 text-left text-sm",
                    step === 3
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                O relatório do mapa comportamental será exibido somente após a conclusão do envio,
                com os gráficos e análises finais.
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || !selfSelected.length || !othersSelected.length}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                <CheckCircle2 size={16} />
                {submitting ? "Enviando..." : "Enviar respostas"}
              </button>
            </div>
          </>
        ) : null}

        {inviteStatus === "completed" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            Questionário concluído com sucesso. O relatório do mapa comportamental ficará disponível
            no portal interno, com os gráficos e análises finais.
          </div>
        ) : null}

        {msg ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            {msg}
          </div>
        ) : null}
      </div>
    </div>
  );
}
