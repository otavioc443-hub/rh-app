"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ListChecks, Target } from "lucide-react";

type DetailTab = "notas" | "resultados" | "pdi" | "one_on_one";

export type FeedbackDetailsRow = {
  id: string;
  created_at: string;
  target_name: string | null;
  evaluator_name: string | null;
  source_role: string | null;
  comment: string | null;
  details_json: Record<string, unknown> | null;
  final_score: number | null;
  final_classification: string | null;
  status: string | null;
  released_to_collaborator: boolean | null;
  one_on_one_completed_at?: string | null;
  one_on_one_notes?: string | null;
  acknowledged_at?: string | null;
  collaborator_comment?: string | null;
};

type PdiItem = {
  goal: string;
  action: string;
  deadline: string | null;
  responsible: string;
  indicator: string;
};

function formatSourceRole(role: string | null) {
  if (role === "admin") return "Administrador";
  if (role === "rh") return "RH";
  if (role === "gestor") return "Gestor";
  if (role === "coordenador") return "Coordenador";
  return role ?? "-";
}

function formatFeedbackStatus(status: string | null) {
  if (status === "sent") return "Enviado";
  if (status === "draft") return "Rascunho";
  if (status === "cancelled") return "Cancelado";
  return status ?? "-";
}

function readScoreSection(details: Record<string, unknown> | null, key: "technical" | "behavioral") {
  const raw = details?.[key];
  if (!raw || typeof raw !== "object") return [] as Array<{ label: string; value: number }>;
  return Object.entries(raw as Record<string, unknown>)
    .map(([label, value]) => ({ label, value: Number(value) }))
    .filter((item) => Number.isFinite(item.value));
}

function readTextField(details: Record<string, unknown> | null, key: string) {
  const value = details?.[key];
  if (typeof value !== "string") return "";
  return value.trim();
}

function readPdiItems(details: Record<string, unknown> | null): PdiItem[] {
  const raw = details?.pdi_items;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        goal: String(row.goal ?? "").trim(),
        action: String(row.action ?? "").trim(),
        deadline: String(row.deadline ?? "").trim() || null,
        responsible: String(row.responsible ?? "").trim(),
        indicator: String(row.indicator ?? "").trim(),
      };
    })
    .filter((item) => item.goal || item.action || item.deadline || item.responsible || item.indicator);
}

function prettifyLabel(value: string) {
  const raw = value.replaceAll("_", " ").replaceAll("-", " ").trim();
  if (!raw) return "-";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatScoreWithMax(value: number, max = 5) {
  return `${value} / ${max}`;
}

function classificationClass(value: string | null) {
  if (value === "Destaque") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "Bom desempenho") return "border-sky-200 bg-sky-50 text-sky-700";
  if (value === "Atencao") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "Critico") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function releaseClass(value: boolean | null) {
  return value ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
}

function averageScore(items: Array<{ label: string; value: number }>) {
  if (!items.length) return null;
  return Number((items.reduce((acc, item) => acc + item.value, 0) / items.length).toFixed(1));
}

function displayName(name: string | null, fallback: string) {
  const cleanName = String(name ?? "").trim();
  if (cleanName) return cleanName;
  return `${fallback} sem nome cadastrado`;
}

type Props = {
  row: FeedbackDetailsRow | null;
  onClose: () => void;
  onSubmitOneOnOne?: (feedbackId: string, notes: string) => Promise<void> | void;
  oneOnOneSaving?: boolean;
};

export default function FeedbackDetailsModal({ row, onClose, onSubmitOneOnOne, oneOnOneSaving = false }: Props) {
  const [detailTab, setDetailTab] = useState<DetailTab>("notas");
  const [oneOnOneDraft, setOneOnOneDraft] = useState(() => row?.one_on_one_notes ?? "");

  const detailTechnical = useMemo(() => (row ? readScoreSection(row.details_json, "technical") : []), [row]);
  const detailBehavioral = useMemo(() => (row ? readScoreSection(row.details_json, "behavioral") : []), [row]);
  const technicalAvg = useMemo(() => averageScore(detailTechnical), [detailTechnical]);
  const behavioralAvg = useMemo(() => averageScore(detailBehavioral), [detailBehavioral]);

  useEffect(() => {
    if (!row) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [row, onClose]);

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-t-2xl border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">Detalhes completos da avaliacao</p>
              <p className="mt-1 text-sm text-slate-700">{displayName(row.target_name, "Colaborador")}</p>
              <p className="mt-1 text-xs text-slate-500">
                Avaliador: {displayName(row.evaluator_name, "Avaliador")} | Perfil: {formatSourceRole(row.source_role)}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Fechar
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Nota final: {row.final_score?.toFixed(1) ?? "-"}
            </span>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${classificationClass(row.final_classification)}`}>
              Classificacao: {row.final_classification ?? "-"}
            </span>
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Status: {formatFeedbackStatus(row.status)}
            </span>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${releaseClass(row.released_to_collaborator)}`}>
              {row.released_to_collaborator ? "Liberado ao colaborador" : "Nao liberado ao colaborador"}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                row.one_on_one_completed_at
                  ? "border-teal-200 bg-teal-50 text-teal-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {row.one_on_one_completed_at ? "One-on-one registrado" : "One-on-one pendente"}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Data: {new Date(row.created_at).toLocaleDateString("pt-BR")}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                row.acknowledged_at
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {row.acknowledged_at ? "Colaborador confirmou recebimento" : "Aguardando ciencia do colaborador"}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {row.acknowledged_at ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">
                Devolutiva confirmada em {new Date(row.acknowledged_at).toLocaleString("pt-BR")}
              </p>
              {row.collaborator_comment ? (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Comentario do colaborador
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{row.collaborator_comment}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-emerald-800">Sem comentario do colaborador.</p>
              )}
            </div>
          ) : null}

          {row.one_on_one_notes ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-xs font-semibold text-teal-700">Anotacoes do one-on-one (interno)</p>
              <p className="mt-1 text-sm text-slate-800">{row.one_on_one_notes}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDetailTab("notas")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${detailTab === "notas" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              <BarChart3 size={14} />
              Notas
            </button>
            <button
              type="button"
              onClick={() => setDetailTab("resultados")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${detailTab === "resultados" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              <Target size={14} />
              Resultados
            </button>
            <button
              type="button"
              onClick={() => setDetailTab("pdi")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${detailTab === "pdi" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              <ListChecks size={14} />
              PDI
            </button>
            <button
              type="button"
              onClick={() => setDetailTab("one_on_one")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${detailTab === "one_on_one" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              One-on-one
            </button>
          </div>

          {detailTab === "notas" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback principal</p>
                <p className="mt-2 text-sm text-slate-800">{row.comment ?? "-"}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-sky-700">Notas tecnicas</p>
                    <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-700">Media: {technicalAvg?.toFixed(1) ?? "-"} / 5</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {detailTechnical.length ? (
                      detailTechnical.map((item) => (
                        <div key={`tech-${row.id}-${item.label}`} className="rounded-lg border border-sky-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-slate-700">{prettifyLabel(item.label)}</p>
                            <p className="text-xs font-semibold text-sky-700">{formatScoreWithMax(item.value)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Sem notas tecnicas.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-violet-700">Notas comportamentais</p>
                    <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-700">Media: {behavioralAvg?.toFixed(1) ?? "-"} / 5</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {detailBehavioral.length ? (
                      detailBehavioral.map((item) => (
                        <div key={`beh-${row.id}-${item.label}`} className="rounded-lg border border-violet-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-slate-700">{prettifyLabel(item.label)}</p>
                            <p className="text-xs font-semibold text-violet-700">{formatScoreWithMax(item.value)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Sem notas comportamentais.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {detailTab === "resultados" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-semibold text-indigo-700">Resultados e evolucao</p>
                <div className="mt-3 space-y-2">
                  {[
                    { label: "Impacto no periodo", value: readTextField(row.details_json, "impact_result") },
                    { label: "Evidencias apresentadas", value: readTextField(row.details_json, "impact_evidence") },
                    { label: "Evolucao observada", value: readTextField(row.details_json, "evolution_result") },
                    { label: "Mudanca percebida", value: readTextField(row.details_json, "evolution_change") },
                    { label: "Resposta do avaliador", value: readTextField(row.details_json, "final_message") },
                  ].map((item) => (
                    <div key={`res-${item.label}`} className="rounded-lg border border-indigo-200 bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-800">{item.value || "Nao informado."}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-700">Sintese</p>
                <div className="mt-3 space-y-2">
                  {[
                    { label: "Pontos fortes", value: readTextField(row.details_json, "strengths") },
                    { label: "Pontos de desenvolvimento", value: readTextField(row.details_json, "development_points") },
                    { label: "Resposta do avaliador", value: readTextField(row.details_json, "final_message") },
                  ].map((item) => (
                    <div key={`syn-${item.label}`} className="rounded-lg border border-emerald-200 bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-800">{item.value || "Nao informado."}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {detailTab === "pdi" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">Plano de desenvolvimento individual</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {readPdiItems(row.details_json).length ? (
                  <div className="space-y-3 pt-1">
                    {readPdiItems(row.details_json).map((item, index) => (
                      <div key={`pdi-item-${row.id}-${index}`} className="rounded-lg border border-emerald-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Meta {index + 1}</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-5">
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Objetivo</p>
                            <p className="mt-1 text-sm text-slate-800">{item.goal || "Nao informado."}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Acao</p>
                            <p className="mt-1 text-sm text-slate-800">{item.action || "Nao informado."}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Prazo</p>
                            <p className="mt-1 text-sm text-slate-800">{item.deadline || "Nao informado."}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Responsavel</p>
                            <p className="mt-1 text-sm text-slate-800">{item.responsible || "Nao informado."}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Indicador</p>
                            <p className="mt-1 text-sm text-slate-800">{item.indicator || "Nao informado."}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-white p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Objetivo</p>
                        <p className="mt-1 text-sm text-slate-800">{readTextField(row.details_json, "pdi_goal") || "Nao informado."}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Acao</p>
                        <p className="mt-1 text-sm text-slate-800">{readTextField(row.details_json, "pdi_action") || "Nao informado."}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {detailTab === "one_on_one" ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-xs font-semibold text-teal-700">Registro interno do one-on-one</p>
              <p className="mt-1 text-xs text-teal-800">
                {row.one_on_one_completed_at
                  ? `Realizado em ${new Date(row.one_on_one_completed_at).toLocaleString("pt-BR")}`
                  : "Ainda nao registrado."}
              </p>
              <textarea
                value={oneOnOneDraft}
                onChange={(e) => setOneOnOneDraft(e.target.value.slice(0, 2000))}
                placeholder="Anotacoes internas da conversa one-on-one (opcional)."
                className="mt-3 min-h-[120px] w-full rounded-lg border border-teal-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-teal-400"
                disabled={!onSubmitOneOnOne}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-teal-700">{oneOnOneDraft.length}/2000</p>
                {onSubmitOneOnOne ? (
                  <button
                    type="button"
                    onClick={() => void onSubmitOneOnOne(row.id, oneOnOneDraft)}
                    disabled={oneOnOneSaving}
                    className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-60"
                  >
                    {oneOnOneSaving
                      ? "Salvando..."
                      : row.one_on_one_completed_at
                      ? "Salvar anotacoes"
                      : "Registrar one-on-one"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


