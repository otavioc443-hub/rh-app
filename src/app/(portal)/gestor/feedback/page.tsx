"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import TeamPdiManager from "@/components/pdi/TeamPdiManager";
import FeedbackDetailsModal, { type FeedbackDetailsRow } from "@/components/feedback/FeedbackDetailsModal";

type CollaboratorOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CycleInfo = {
  id: string;
  name: string;
  collect_start: string;
  collect_end: string;
  release_start: string;
  release_end: string;
  one_on_one_warn_days: number;
  one_on_one_danger_days: number;
  collaborator_ack_warn_days: number;
  collaborator_ack_danger_days: number;
  active: boolean;
};

type SentFeedbackRow = {
  id: string;
  created_at: string;
  target_name: string | null;
  target_email: string | null;
  evaluator_name: string | null;
  evaluator_email: string | null;
  source_role: string | null;
  cycle_name: string | null;
  comment: string | null;
  details_json: Record<string, unknown> | null;
  final_score: number | null;
  final_classification: string | null;
  status: string | null;
  released_to_collaborator: boolean | null;
  one_on_one_completed_at: string | null;
  one_on_one_notes: string | null;
  acknowledged_at: string | null;
  collaborator_comment: string | null;
};

type HistoryFilter = "all" | "released" | "hidden";
type ViewTab = "history" | "apply";

type PdiDraft = {
  goal: string;
  action: string;
  deadline: string;
  responsible: string;
  indicator: string;
};

type TechnicalKey = "entrega" | "qualidade" | "autonomia" | "organizacao" | "responsabilidade";
type BehaviorKey =
  | "comunicacao"
  | "trabalho_equipe"
  | "postura"
  | "proatividade"
  | "adaptabilidade"
  | "inteligencia_emocional";

const TECHNICAL: Array<{ key: TechnicalKey; label: string }> = [
  { key: "entrega", label: "Entrega" },
  { key: "qualidade", label: "Qualidade" },
  { key: "autonomia", label: "Autonomia" },
  { key: "organizacao", label: "Organização" },
  { key: "responsabilidade", label: "Responsabilidade" },
];

const BEHAVIORAL: Array<{ key: BehaviorKey; label: string }> = [
  { key: "comunicacao", label: "Comunicação clara e objetiva" },
  { key: "trabalho_equipe", label: "Trabalho em equipe" },
  { key: "postura", label: "Postura profissional" },
  { key: "proatividade", label: "Proatividade" },
  { key: "adaptabilidade", label: "Adaptabilidade a mudanças" },
  { key: "inteligencia_emocional", label: "Inteligência emocional" },
];

function classification(finalScore: number) {
  if (finalScore >= 9) return "Destaque";
  if (finalScore >= 7) return "Bom desempenho";
  if (finalScore >= 5) return "Atenção";
  return "Crítico";
}

const IMPACT_OPTIONS = [
  "Muito acima do esperado",
  "Acima do esperado",
  "Dentro do esperado",
  "Abaixo do esperado",
  "Crítico",
] as const;

const EVOLUTION_OPTIONS = [
  "Evoluiu significativamente",
  "Evoluiu moderadamente",
  "Manteve desempenho",
  "Apresentou regressão",
] as const;

const EMPTY_PDI_ITEM: PdiDraft = {
  goal: "",
  action: "",
  deadline: "",
  responsible: "",
  indicator: "",
};

const TECHNICAL_GUIDES: Record<TechnicalKey, string> = {
  entrega: "Cumpre combinados, prazos e escopo esperado das atividades?",
  qualidade: "Entrega com cuidado técnico, consistência e baixo retrabalho?",
  autonomia: "Consegue conduzir atividades com pouca dependência e boa tomada de decisão?",
  organizacao: "Mantém rotina, prioridades e registros de forma clara e previsível?",
  responsabilidade: "Assume compromissos, sinaliza riscos e sustenta o que foi acordado?",
};

const BEHAVIORAL_GUIDES: Record<BehaviorKey, string> = {
  comunicacao: "Explica contexto, alinhamentos e bloqueios de forma clara e no tempo certo?",
  trabalho_equipe: "Colabora bem com pares, compartilha contexto e contribui com o grupo?",
  postura: "Demonstra maturidade, respeito e coerência na atuação profissional?",
  proatividade: "Antecipou necessidades, propos melhorias ou agiu antes da cobranca?",
  adaptabilidade: "Lidou bem com mudanças de demanda, contexto ou prioridade?",
  inteligencia_emocional: "Equilibra reações, escuta o outro e lida bem com pressão e feedback?",
};

function releaseBadge(released: boolean | null) {
  if (released) {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        Liberado
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      Não liberado
    </span>
  );
}

function classificationTone(value: string | null) {
  if (value === "Destaque") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "Bom desempenho") return "border-sky-200 bg-sky-50 text-sky-700";
  if (value === "Atenção") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "Crítico") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function ringColorByClassification(value: string | null) {
  if (value === "Destaque") return "#10b981";
  if (value === "Bom desempenho") return "#0ea5e9";
  if (value === "Atenção") return "#f59e0b";
  if (value === "Crítico") return "#ef4444";
  return "#64748b";
}

function scoreRingStyle(score: number | null, classificationValue: string | null) {
  const safeScore = Number.isFinite(score) ? Number(score) : 0;
  const pct = Math.max(0, Math.min(100, (safeScore / 10) * 100));
  const color = ringColorByClassification(classificationValue);
  return {
    background: `conic-gradient(${color} 0% ${pct}%, #e2e8f0 ${pct}% 100%)`,
  };
}

function daysPendingSince(iso: string | null | undefined) {
  if (!iso) return 0;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return 0;
  const diff = Date.now() - start;
  if (diff <= 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function pendingToneClass(days: number, warnFrom: number, dangerFrom: number) {
  if (days >= dangerFrom) return "border-rose-200 bg-rose-50 text-rose-700";
  if (days >= warnFrom) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function GestorFeedbackPage() {
  const searchParams = useSearchParams();
  const pdiMode = searchParams.get("tab") === "pdi";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [oneOnOneSavingId, setOneOnOneSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [coordinators, setCoordinators] = useState<CollaboratorOption[]>([]);
  const [historyRows, setHistoryRows] = useState<SentFeedbackRow[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [viewTab, setViewTab] = useState<ViewTab>("history");
  const [selectedDetails, setSelectedDetails] = useState<FeedbackDetailsRow | null>(null);
  const [targetUserId, setTargetUserId] = useState("");

  const [technical, setTechnical] = useState<Record<TechnicalKey, number>>({
    entrega: 0,
    qualidade: 0,
    autonomia: 0,
    organizacao: 0,
    responsabilidade: 0,
  });
  const [behavioral, setBehavioral] = useState<Record<BehaviorKey, number>>({
    comunicacao: 0,
    trabalho_equipe: 0,
    postura: 0,
    proatividade: 0,
    adaptabilidade: 0,
    inteligencia_emocional: 0,
  });

  const [impactResult, setImpactResult] = useState<string>("Dentro do esperado");
  const [impactEvidence, setImpactEvidence] = useState("");
  const [evolutionResult, setEvolutionResult] = useState<string>("Manteve desempenho");
  const [evolutionChange, setEvolutionChange] = useState("");
  const [strengths, setStrengths] = useState("");
  const [developmentPoints, setDevelopmentPoints] = useState("");
  const [finalMessage, setFinalMessage] = useState("");

  const [pdiItems, setPdiItems] = useState<PdiDraft[]>([{ ...EMPTY_PDI_ITEM }]);

  const finalScore = useMemo(() => {
    const vals = [...Object.values(technical), ...Object.values(behavioral)];
    return Number(((vals.reduce((a, b) => a + b, 0) / vals.length) * 2).toFixed(1));
  }, [technical, behavioral]);

  const filteredHistoryRows = useMemo(() => {
    if (historyFilter === "released") return historyRows.filter((row) => row.released_to_collaborator === true);
    if (historyFilter === "hidden") return historyRows.filter((row) => row.released_to_collaborator !== true);
    return historyRows;
  }, [historyRows, historyFilter]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [cycleRes, collabRes, historyRes] = await Promise.all([
        fetch("/api/feedback/cycle", { method: "GET" }),
        fetch("/api/feedback/collaborators?targetRole=coordenador", { method: "GET" }),
        fetch("/api/feedback/sent", { method: "GET" }),
      ]);
      const collabJson = await collabRes.json();
      const historyJson = await historyRes.json();
      if (!collabRes.ok) throw new Error(collabJson?.error ?? "Falha ao carregar coordenadores.");
      if (!historyRes.ok) throw new Error(historyJson?.error ?? "Falha ao carregar historico de feedbacks.");
      setCoordinators((collabJson.rows ?? []) as CollaboratorOption[]);
      const sentRows = (historyJson.rows ?? []) as SentFeedbackRow[];
      setHistoryRows(sentRows);

      if (cycleRes.ok) {
        const cycleJson = await cycleRes.json();
        setCycle(cycleJson.cycle ?? null);
        setCollectOpen(cycleJson.collectOpen === true);
      } else {
        setCycle(null);
        setCollectOpen(false);
        setMsg("Lista de coordenadores carregada. Ciclo de feedback não configurado ou indisponível.");
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markOneOnOne(feedbackId: string, notes?: string) {
    setOneOnOneSavingId(feedbackId);
    setMsg("");
    try {
      const note = String(notes ?? "").trim();
      const res = await fetch("/api/feedback/sent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_id: feedbackId,
          one_on_one_completed: true,
          one_on_one_notes: note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao registrar one-on-one.");
      const completedAt = String(json?.one_on_one_completed_at ?? new Date().toISOString());
      const savedNotes = typeof json?.one_on_one_notes === "string" ? json.one_on_one_notes : note;
      setHistoryRows((prev) =>
        prev.map((row) =>
          row.id === feedbackId
            ? { ...row, one_on_one_completed_at: completedAt, one_on_one_notes: savedNotes }
            : row
        )
      );
      setSelectedDetails((prev) =>
        prev && prev.id === feedbackId
          ? { ...prev, one_on_one_completed_at: completedAt, one_on_one_notes: savedNotes }
          : prev
      );
      setMsg("One-on-one registrado com sucesso.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar one-on-one.");
    } finally {
      setOneOnOneSavingId(null);
    }
  }

  function setTech(key: TechnicalKey, value: number) {
    setTechnical((prev) => ({ ...prev, [key]: value }));
  }
  function setBeh(key: BehaviorKey, value: number) {
    setBehavioral((prev) => ({ ...prev, [key]: value }));
  }

  function updatePdiItem(index: number, patch: Partial<PdiDraft>) {
    setPdiItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addPdiItem() {
    setPdiItems((prev) => [...prev, { ...EMPTY_PDI_ITEM }]);
  }

  function removePdiItem(index: number) {
    setPdiItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)));
  }

  async function submit(status: "draft" | "sent") {
    setMsg("");
    if (!targetUserId) return setMsg("Selecione o coordenador avaliado.");
    if (status === "sent") {
      const hasUnscored = [...Object.values(technical), ...Object.values(behavioral)].some((n) => n < 1 || n > 5);
      if (hasUnscored) return setMsg("Preencha todas as notas (1 a 5) antes de enviar.");
      if (!finalMessage.trim()) return setMsg("Preencha o feedback final do gestor.");
    }

    setSubmitting(true);
    try {
      const normalizedPdiItems = pdiItems
        .map((item) => ({
          goal: item.goal.trim(),
          action: item.action.trim(),
          deadline: item.deadline || null,
          responsible: item.responsible.trim(),
          indicator: item.indicator.trim(),
        }))
        .filter((item) => item.goal || item.action || item.deadline || item.responsible || item.indicator);
      const primaryPdiItem = normalizedPdiItems[0] ?? null;
      const details = {
        technical,
        behavioral,
        impact_result: impactResult,
        impact_evidence: impactEvidence.trim(),
        evolution_result: evolutionResult,
        evolution_change: evolutionChange.trim(),
        strengths: strengths.trim(),
        development_points: developmentPoints.trim(),
        pdi_goal: primaryPdiItem?.goal ?? "",
        pdi_action: primaryPdiItem?.action ?? "",
        pdi_deadline: primaryPdiItem?.deadline ?? null,
        pdi_responsible: primaryPdiItem?.responsible ?? "",
        pdi_indicator: primaryPdiItem?.indicator ?? "",
        pdi_items: normalizedPdiItems,
        final_message: finalMessage.trim(),
      };

      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: targetUserId,
          scores: { ...technical, ...behavioral },
          comment: finalMessage.trim() || developmentPoints.trim() || strengths.trim(),
          short_term_action: primaryPdiItem?.action ?? "",
          final_score: finalScore,
          details,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao registrar feedback.");
      setMsg(status === "draft" ? "Rascunho salvo." : "Feedback enviado e PDI de curto prazo criado.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pdiMode) {
    return (
      <div className="space-y-6">
        <TeamPdiManager
          title="Gestao de PDI da equipe"
          subtitle="Atualize o andamento dos PDIs dos coordenadores da sua equipe."
        />
        {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Feedback do Gestor</h1>
            <p className="mt-1 text-sm text-slate-600">Avaliação de coordenadores com foco em resultados e liderança.</p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading || submitting}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Ciclo ativo</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{cycle?.name ?? "Não configurado"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Coleta aberta</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{collectOpen ? "Sim" : "Não"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Classificação</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{classification(finalScore)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewTab("history")}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
              viewTab === "history"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            Feedbacks realizados
          </button>
          <button
            type="button"
            onClick={() => setViewTab("apply")}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
              viewTab === "apply"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            Realizar feedback
          </button>
        </div>
      </div>

      {viewTab === "history" ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-900">Historico de feedbacks enviados</h2>
          <select
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value as HistoryFilter)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="all">Todos</option>
            <option value="released">Liberado</option>
            <option value="hidden">Não liberado</option>
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {filteredHistoryRows.length ? (
            filteredHistoryRows.map((row) => (
              (() => {
                const oneOnOneDaysPending = row.one_on_one_completed_at ? 0 : daysPendingSince(row.created_at);
                const showAckPending = row.released_to_collaborator === true && !!row.one_on_one_completed_at && !row.acknowledged_at;
                const ackDaysPending = showAckPending
                  ? daysPendingSince(row.one_on_one_completed_at ?? row.created_at)
                  : 0;
                const oneOnOneWarnDays = Math.max(1, Number(cycle?.one_on_one_warn_days ?? 2));
                const oneOnOneDangerDays = Math.max(
                  oneOnOneWarnDays,
                  Number(cycle?.one_on_one_danger_days ?? 5)
                );
                const ackWarnDays = Math.max(1, Number(cycle?.collaborator_ack_warn_days ?? 3));
                const ackDangerDays = Math.max(
                  ackWarnDays,
                  Number(cycle?.collaborator_ack_danger_days ?? 7)
                );

                return (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-sky-50/40 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:justify-between">
                  <div className="flex-1">
                    <p className="text-base font-semibold text-slate-900">{row.target_name ?? row.target_email ?? "Coordenador"}</p>
                    <p className="mt-1 text-xs text-slate-600">Ciclo: {row.cycle_name ?? "-"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {releaseBadge(row.released_to_collaborator)}
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classificationTone(row.final_classification)}`}>
                        {row.final_classification ?? "Sem classificação"}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          row.one_on_one_completed_at
                            ? "border-teal-200 bg-teal-50 text-teal-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.one_on_one_completed_at ? "One-on-one registrado" : "One-on-one pendente"}
                      </span>
                      {!row.one_on_one_completed_at ? (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pendingToneClass(
                            oneOnOneDaysPending,
                            oneOnOneWarnDays,
                            oneOnOneDangerDays
                          )}`}
                        >
                          Pendente ha {oneOnOneDaysPending} dia(s)
                        </span>
                      ) : null}
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          row.acknowledged_at
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                          {row.acknowledged_at ? "Devolutiva confirmada" : "Aguardando confirmação do colaborador"}
                      </span>
                      {showAckPending ? (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pendingToneClass(
                            ackDaysPending,
                            ackWarnDays,
                            ackDangerDays
                          )}`}
                        >
                          Sem devolutiva ha {ackDaysPending} dia(s)
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">{row.comment ?? "-"}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Data: {new Date(row.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 md:min-w-[240px]">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-14 rounded-full p-1" style={scoreRingStyle(row.final_score, row.final_classification)}>
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-900">
                          {row.final_score?.toFixed(1) ?? "-"}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Nota final</p>
                        <p className="text-sm font-semibold text-slate-900">{row.final_score?.toFixed(1) ?? "-"} / 10</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                      <p>
                        One-on-one:{" "}
                        {row.one_on_one_completed_at
                          ? new Date(row.one_on_one_completed_at).toLocaleDateString("pt-BR")
                          : `Pendente ha ${oneOnOneDaysPending} dia(s)`}
                      </p>
                      <p>
                        Devolutiva:{" "}
                        {row.acknowledged_at
                          ? new Date(row.acknowledged_at).toLocaleDateString("pt-BR")
                          : showAckPending
                          ? `Pendente ha ${ackDaysPending} dia(s)`
                          : "Pendente"}
                      </p>
                      {row.one_on_one_notes ? (
                        <p className="text-teal-700">Anotação one-on-one registrada</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDetails(row)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Ver detalhes
                  </button>
                </div>
              </div>
                );
              })()
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhum feedback para o filtro selecionado.
            </div>
          )}
        </div>
      </div>
      ) : null}

      {viewTab === "apply" ? (collectOpen ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">Perguntas norteadoras da avaliação</p>
          <p className="mt-1 text-xs text-slate-700">
            Use os quesitos considerando evidências do período, recorrência do comportamento e impacto gerado na rotina e nas entregas.
          </p>
          <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
            <p>Considere fatos observáveis, e não apenas percepções isoladas.</p>
            <p>Avalie a frequencia: foi algo pontual ou consistente durante o ciclo?</p>
            <p>Pense no impacto para equipe, prazo, qualidade e relacionamento.</p>
            <p>Nas respostas abertas, cite exemplos concretos sempre que possivel.</p>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-900">Coordenador avaliado</label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="">Selecione...</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.email ?? c.id}
              </option>
            ))}
          </select>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">1. Avaliação técnica (1-5)</h2>
          {TECHNICAL.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="text-sm text-slate-800">{item.label}</span>
                <p className="mt-1 text-xs text-slate-500">{TECHNICAL_GUIDES[item.key]}</p>
              </div>
              <div>
                <p className="mb-2 text-center text-[11px] text-slate-500">1 = pouca aderencia | 5 = muita aderencia</p>
                <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTech(item.key, n)}
                    className={[
                      "h-9 w-9 rounded-lg border text-xs font-semibold transition-colors",
                      technical[item.key] === n
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-900 hover:text-white",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">2. Competências comportamentais (1-5)</h2>
          {BEHAVIORAL.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="text-sm text-slate-800">{item.label}</span>
                <p className="mt-1 text-xs text-slate-500">{BEHAVIORAL_GUIDES[item.key]}</p>
              </div>
              <div>
                <p className="mb-2 text-center text-[11px] text-slate-500">1 = baixa presenca | 5 = presenca forte e consistente</p>
                <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBeh(item.key, n)}
                    className={[
                      "h-9 w-9 rounded-lg border text-xs font-semibold transition-colors",
                      behavioral[item.key] === n
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-900 hover:text-white",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-900">3. Resultados e impacto</label>
            <p className="mt-1 text-xs text-slate-500">O que essa pessoa efetivamente gerou de resultado para a equipe, rotina ou entregas neste ciclo?</p>
            <select value={impactResult} onChange={(e) => setImpactResult(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
              {IMPACT_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <textarea value={impactEvidence} onChange={(e) => setImpactEvidence(e.target.value)} placeholder="Cite exemplos que sustentem sua avaliação" className="mt-2 min-h-[100px] w-full rounded-xl border border-slate-200 p-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-900">4. Evolução no período</label>
            <p className="mt-1 text-xs text-slate-500">Em comparação ao início do ciclo, houve amadurecimento, estabilidade ou regressão? Em quais pontos?</p>
            <select value={evolutionResult} onChange={(e) => setEvolutionResult(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
              {EVOLUTION_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <textarea value={evolutionChange} onChange={(e) => setEvolutionChange(e.target.value)} placeholder="O que mudou em sua percepcao?" className="mt-2 min-h-[100px] w-full rounded-xl border border-slate-200 p-3 text-sm" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">5. Pontos fortes</p>
            <p className="mt-1 text-xs text-slate-500">Quais comportamentos e entregas devem ser preservados e potencializados?</p>
            <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Ex.: boa comunicação com a equipe, constância nas entregas, autonomia..." className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">6. Pontos de desenvolvimento prioritarios</p>
            <p className="mt-1 text-xs text-slate-500">Quais lacunas merecem foco imediato e que impacto elas geram hoje?</p>
            <textarea value={developmentPoints} onChange={(e) => setDevelopmentPoints(e.target.value)} placeholder="Ex.: organização, previsibilidade, qualidade técnica, colaboração..." className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">7. PDI de curto prazo</h2>
          <div className="space-y-3">
            {pdiItems.map((item, index) => (
              <div key={`pdi-${index}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meta {index + 1}</p>
                  {pdiItems.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removePdiItem(index)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Remover meta
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={item.goal}
                    onChange={(e) => updatePdiItem(index, { goal: e.target.value })}
                    placeholder="Meta de desenvolvimento"
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <input
                    value={item.action}
                    onChange={(e) => updatePdiItem(index, { action: e.target.value })}
                    placeholder="Ação sugerida"
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <input
                    type="date"
                    value={item.deadline}
                    onChange={(e) => updatePdiItem(index, { deadline: e.target.value })}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <input
                    value={item.responsible}
                    onChange={(e) => updatePdiItem(index, { responsible: e.target.value })}
                    placeholder="Responsavel"
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <input
                    value={item.indicator}
                    onChange={(e) => updatePdiItem(index, { indicator: e.target.value })}
                    placeholder="Indicador de sucesso"
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPdiItem}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            + Nova meta
          </button>
        </section>

        <section>
          <label className="text-sm font-semibold text-slate-900">8. Feedback final do gestor</label>
          <p className="mt-1 text-xs text-slate-500">Qual mensagem final ajuda a pessoa a entender reconhecimento, ajustes esperados e proximo passo?</p>
          <textarea
            value={finalMessage}
            onChange={(e) => setFinalMessage(e.target.value)}
            className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm"
            placeholder="Orientação, reconhecimento e direcionamento."
          />
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void submit("draft")} disabled={loading || submitting || !collectOpen} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Salvar rascunho</button>
          <button type="button" onClick={() => void submit("sent")} disabled={loading || submitting || !collectOpen} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Enviar feedback</button>
        </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-sm font-semibold text-amber-900">Critérios de avaliação bloqueados</h2>
          <p className="mt-2 text-sm text-amber-800">
            O RH ainda não liberou o período para realização da avaliação. Os critérios e o formulário só ficam
            visíveis durante a janela de coleta.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Próxima janela configurada:{" "}
            {cycle?.collect_start ? new Date(cycle.collect_start).toLocaleString("pt-BR") : "-"} ate{" "}
            {cycle?.collect_end ? new Date(cycle.collect_end).toLocaleString("pt-BR") : "-"}.
          </p>
        </div>
      )) : null}

      {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}
      <FeedbackDetailsModal
        key={selectedDetails?.id ?? "none"}
        row={selectedDetails}
        onClose={() => setSelectedDetails(null)}
        onSubmitOneOnOne={async (feedbackId, notes) => {
          await markOneOnOne(feedbackId, notes);
        }}
        oneOnOneSaving={oneOnOneSavingId === selectedDetails?.id}
      />
    </div>
  );
}
