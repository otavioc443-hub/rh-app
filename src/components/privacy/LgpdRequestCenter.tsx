"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, FileInput, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RequestType = "access" | "correction" | "deletion" | "opposition" | "portability" | "review" | "information" | "other";
type RequestStatus = "pending" | "in_review" | "approved" | "rejected" | "implemented" | "cancelled";

type LgpdRequestRow = {
  id: string;
  requester_user_id: string;
  request_type: RequestType;
  title: string;
  details: string;
  status: RequestStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const REQUEST_OPTIONS: Array<{ value: RequestType; label: string; hint: string }> = [
  { value: "access", label: "Acesso aos dados", hint: "Solicitar confirmacao e copia dos dados tratados." },
  { value: "correction", label: "Correcao", hint: "Corrigir informacoes incompletas, inexatas ou desatualizadas." },
  { value: "deletion", label: "Eliminacao", hint: "Solicitar eliminacao, observadas as hipoteses legais de guarda." },
  { value: "opposition", label: "Oposicao", hint: "Questionar tratamento com base em situacao especifica." },
  { value: "portability", label: "Portabilidade", hint: "Solicitar informacoes para portabilidade, quando aplicavel." },
  { value: "review", label: "Revisao", hint: "Solicitar revisao de decisao com efeito relevante ao titular." },
  { value: "information", label: "Informacoes", hint: "Pedir detalhes sobre finalidade, base legal e compartilhamento." },
  { value: "other", label: "Outro", hint: "Registrar demanda de privacidade que nao se enquadra nas anteriores." },
];

function statusLabel(status: RequestStatus) {
  if (status === "pending") return "Pendente";
  if (status === "in_review") return "Em analise";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  if (status === "implemented") return "Concluida";
  return "Cancelada";
}

function statusClass(status: RequestStatus) {
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "in_review") return "bg-sky-50 text-sky-700";
  if (status === "approved" || status === "implemented") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

export default function LgpdRequestCenter() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<LgpdRequestRow[]>([]);
  const [requestType, setRequestType] = useState<RequestType>("access");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const res = await supabase
        .from("lgpd_requests")
        .select("id,requester_user_id,request_type,title,details,status,review_notes,reviewed_at,created_at")
        .order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
      setRows((res.data ?? []) as LgpdRequestRow[]);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : "Erro ao carregar solicitacoes LGPD.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedOption = useMemo(
    () => REQUEST_OPTIONS.find((option) => option.value === requestType) ?? REQUEST_OPTIONS[0],
    [requestType]
  );

  async function submitRequest() {
    const trimmedTitle = title.trim();
    const trimmedDetails = details.trim();
    if (!trimmedTitle || !trimmedDetails) {
      setMessage("Preencha titulo e detalhes da solicitacao.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const authRes = await supabase.auth.getUser();
      const userId = authRes.data.user?.id;
      if (!userId) throw new Error("Sessao invalida. Faca login novamente.");

      const insertRes = await supabase.from("lgpd_requests").insert({
        requester_user_id: userId,
        request_type: requestType,
        title: trimmedTitle,
        details: trimmedDetails,
      });
      if (insertRes.error) throw new Error(insertRes.error.message);

      setTitle("");
      setDetails("");
      setRequestType("access");
      setMessage("Solicitacao LGPD registrada com sucesso.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao registrar solicitacao.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest(row: LgpdRequestRow) {
    if (row.status !== "pending") return;
    if (!window.confirm("Cancelar esta solicitacao LGPD?")) return;

    setSaving(true);
    setMessage("");
    try {
      const res = await supabase.from("lgpd_requests").update({ status: "cancelled" }).eq("id", row.id);
      if (res.error) throw new Error(res.error.message);
      setMessage("Solicitacao cancelada.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao cancelar solicitacao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <FileInput size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Solicitar atendimento LGPD</h2>
            <p className="text-sm text-slate-500">Abra uma demanda formal de titular diretamente pelo portal.</p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Tipo de solicitacao
            <select
              value={requestType}
              onChange={(event) => setRequestType(event.target.value as RequestType)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              {REQUEST_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{selectedOption.hint}</div>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Titulo
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              placeholder="Ex.: Solicito acesso aos meus dados do portal"
            />
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Detalhes
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              className="min-h-[148px] rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
              placeholder="Descreva o pedido, o contexto e o que voce espera receber como retorno."
            />
          </label>

          <button
            type="button"
            onClick={() => void submitRequest()}
            disabled={saving || loading}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Enviando..." : "Registrar solicitacao"}
          </button>
        </div>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Clock3 size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Historico do titular</h2>
            <p className="text-sm text-slate-500">Acompanhe andamento, notas e datas das demandas registradas.</p>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Carregando...</div>
          ) : rows.length ? (
            rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{row.details}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                    {statusLabel(row.status)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                  <p><span className="font-semibold text-slate-700">Tipo:</span> {REQUEST_OPTIONS.find((item) => item.value === row.request_type)?.label ?? row.request_type}</p>
                  <p><span className="font-semibold text-slate-700">Criada em:</span> {formatDate(row.created_at)}</p>
                  <p><span className="font-semibold text-slate-700">Revisada em:</span> {formatDate(row.reviewed_at)}</p>
                </div>

                {row.review_notes ? (
                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <ShieldCheck size={14} />
                      Retorno da analise
                    </div>
                    {row.review_notes}
                  </div>
                ) : null}

                {row.status === "pending" ? (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void cancelRequest(row)}
                      disabled={saving}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Cancelar solicitacao
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Nenhuma solicitacao LGPD registrada ate o momento.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
