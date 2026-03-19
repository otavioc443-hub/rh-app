"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ListChecks, RefreshCcw, Target } from "lucide-react";

type FeedbackRow = {
  id: string;
  created_at: string;
  cycle_name: string | null;
  target_name: string | null;
  target_email: string | null;
  evaluator_name: string | null;
  evaluator_email: string | null;
  target_department_name: string | null;
  source_role: string | null;
  comment: string | null;
  details_json: Record<string, unknown> | null;
  final_score: number | null;
  final_classification: string | null;
  status: string | null;
  released_to_collaborator: boolean | null;
  one_on_one_completed_at: string | null;
  one_on_one_completed_by: string | null;
  one_on_one_completed_by_name: string | null;
  one_on_one_notes: string | null;
  acknowledged_at: string | null;
  collaborator_comment: string | null;
};

type CycleRow = {
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
  created_at: string;
  feedback_count?: number;
  sent_feedback_count?: number;
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
  if (value === "Atenção") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "Crítico") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function releaseClass(value: boolean | null) {
  return value ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
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

function averageScore(items: Array<{ label: string; value: number }>) {
  if (!items.length) return null;
  return Number((items.reduce((acc, item) => acc + item.value, 0) / items.length).toFixed(1));
}

type PdiItem = {
  goal: string;
  action: string;
  deadline: string | null;
  responsible: string;
  indicator: string;
};

type DetailTab = "notas" | "resultados" | "pdi" | "devolutiva";

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

function displayName(name: string | null, fallback: string) {
  const cleanName = String(name ?? "").trim();
  if (cleanName) return cleanName;
  return `${fallback} sem nome cadastrado`;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function RHFeedbacksPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingCycleId, setDeletingCycleId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<FeedbackRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("notas");

  const [name, setName] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [editingCycle, setEditingCycle] = useState(false);
  const [cycleRows, setCycleRows] = useState<CycleRow[]>([]);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [actorRole, setActorRole] = useState<"rh" | "admin" | string>("");
  const [totalCompanyCollaborators, setTotalCompanyCollaborators] = useState(0);
  const [collectStart, setCollectStart] = useState("");
  const [collectEnd, setCollectEnd] = useState("");
  const [releaseStart, setReleaseStart] = useState("");
  const [releaseEnd, setReleaseEnd] = useState("");
  const [oneOnOneWarnDays, setOneOnOneWarnDays] = useState("2");
  const [oneOnOneDangerDays, setOneOnOneDangerDays] = useState("5");
  const [collaboratorAckWarnDays, setCollaboratorAckWarnDays] = useState("3");
  const [collaboratorAckDangerDays, setCollaboratorAckDangerDays] = useState("7");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [collaboratorFilter, setCollaboratorFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const deletingCycle = deletingCycleId !== null;

  const detailTechnical = useMemo(
    () => (selectedDetails ? readScoreSection(selectedDetails.details_json, "technical") : []),
    [selectedDetails]
  );
  const detailBehavioral = useMemo(
    () => (selectedDetails ? readScoreSection(selectedDetails.details_json, "behavioral") : []),
    [selectedDetails]
  );
  const technicalAvg = useMemo(() => averageScore(detailTechnical), [detailTechnical]);
  const behavioralAvg = useMemo(() => averageScore(detailBehavioral), [detailBehavioral]);
  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.target_department_name?.trim() || "Sem departamento").filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );
  const collaboratorOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => String(r.target_name ?? "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );
  const managerOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => displayName(r.evaluator_name, "Avaliador")).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows]
  );
  const periodOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.cycle_name ?? "-").filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [rows]
  );
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const department = r.target_department_name?.trim() || "Sem departamento";
      const collaborator = displayName(r.target_name, "Colaborador");
      const manager = displayName(r.evaluator_name, "Avaliador");
      const period = r.cycle_name ?? "-";
      if (departmentFilter !== "all" && department !== departmentFilter) return false;
      if (collaboratorFilter !== "all" && collaborator !== collaboratorFilter) return false;
      if (managerFilter !== "all" && manager !== managerFilter) return false;
      if (periodFilter !== "all" && period !== periodFilter) return false;
      return true;
    });
  }, [rows, departmentFilter, collaboratorFilter, managerFilter, periodFilter]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [cycleRes, rowsRes] = await Promise.all([
        fetch("/api/feedback/cycle?include_all=1", { method: "GET" }),
        fetch("/api/feedback/rh", { method: "GET" }),
      ]);
      const cycleJson = await cycleRes.json();
      const rowsJson = await rowsRes.json();
      if (!cycleRes.ok) throw new Error(cycleJson?.error ?? "Falha ao carregar ciclo.");
      if (!rowsRes.ok) throw new Error(rowsJson?.error ?? "Falha ao carregar feedbacks.");

      setRows((rowsJson.rows ?? []) as FeedbackRow[]);
      const allCycles = Array.isArray(cycleJson.cycles)
        ? (cycleJson.cycles as CycleRow[])
        : cycleJson.cycle
        ? [cycleJson.cycle as CycleRow]
        : [];
      setActorRole(String(cycleJson.actor_role ?? ""));
      setTotalCompanyCollaborators(Number(cycleJson.total_company_collaborators ?? 0));
      setCycleRows(allCycles);

      const activeCycle =
        (cycleJson.cycle as CycleRow | null | undefined) ??
        allCycles.find((row) => row.active) ??
        null;
      if (activeCycle) {
        setCycleId(String(activeCycle.id ?? ""));
        setName(String(activeCycle.name ?? ""));
        setCollectStart(String(activeCycle.collect_start ?? "").slice(0, 16));
        setCollectEnd(String(activeCycle.collect_end ?? "").slice(0, 16));
        setReleaseStart(String(activeCycle.release_start ?? "").slice(0, 16));
        setReleaseEnd(String(activeCycle.release_end ?? "").slice(0, 16));
        setOneOnOneWarnDays(String(activeCycle.one_on_one_warn_days ?? 2));
        setOneOnOneDangerDays(String(activeCycle.one_on_one_danger_days ?? 5));
        setCollaboratorAckWarnDays(String(activeCycle.collaborator_ack_warn_days ?? 3));
        setCollaboratorAckDangerDays(String(activeCycle.collaborator_ack_danger_days ?? 7));
        setEditingCycle(false);
        setExpandedCycleId(null);
      } else {
        setCycleId("");
        setName("");
        setCollectStart("");
        setCollectEnd("");
        setReleaseStart("");
        setReleaseEnd("");
        setOneOnOneWarnDays("2");
        setOneOnOneDangerDays("5");
        setCollaboratorAckWarnDays("3");
        setCollaboratorAckDangerDays("7");
        setEditingCycle(false);
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedDetails) return;
    setDetailTab("notas");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDetails(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedDetails]);

  async function saveCycle() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/feedback/cycle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cycleId || undefined,
          name,
          collect_start: new Date(collectStart).toISOString(),
          collect_end: new Date(collectEnd).toISOString(),
          release_start: new Date(releaseStart).toISOString(),
          release_end: new Date(releaseEnd).toISOString(),
          one_on_one_warn_days: Number(oneOnOneWarnDays),
          one_on_one_danger_days: Number(oneOnOneDangerDays),
          collaborator_ack_warn_days: Number(collaboratorAckWarnDays),
          collaborator_ack_danger_days: Number(collaboratorAckDangerDays),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao salvar ciclo.");
      setMsg("Ciclo de feedback atualizado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar ciclo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRelease(feedbackId: string, release: boolean) {
    setMsg("");
    try {
      const res = await fetch("/api/feedback/rh", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_id: feedbackId,
          released_to_collaborator: release,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao atualizar liberacao.");
      setRows((prev) => prev.map((r) => (r.id === feedbackId ? { ...r, released_to_collaborator: release } : r)));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar.");
    }
  }

  async function deleteCycleAndFeedbacks(targetCycleId?: string) {
    const cycleIdToDelete = String(targetCycleId ?? cycleId ?? "").trim();
    if (!cycleIdToDelete) return setMsg("Nenhum ciclo selecionado para excluir.");
    const confirmed = window.confirm(
      "Excluir ciclo e todos os feedbacks vinculados? Essa acao remove as informacoes para todos os perfis."
    );
    if (!confirmed) return;

    setDeletingCycleId(cycleIdToDelete);
    setMsg("");
    try {
      const res = await fetch("/api/feedback/cycle", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle_id: cycleIdToDelete }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao excluir ciclo.");
      setMsg(
        `Ciclo excluido com sucesso. Feedbacks removidos: ${Number(json?.deleted_feedbacks ?? 0)}.`
      );
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir ciclo.");
    } finally {
      setDeletingCycleId(null);
    }
  }

  function startEditCycle(cycle: CycleRow) {
    setCycleId(String(cycle.id ?? ""));
    setName(String(cycle.name ?? ""));
    setCollectStart(String(cycle.collect_start ?? "").slice(0, 16));
    setCollectEnd(String(cycle.collect_end ?? "").slice(0, 16));
    setReleaseStart(String(cycle.release_start ?? "").slice(0, 16));
    setReleaseEnd(String(cycle.release_end ?? "").slice(0, 16));
    setOneOnOneWarnDays(String(cycle.one_on_one_warn_days ?? 2));
    setOneOnOneDangerDays(String(cycle.one_on_one_danger_days ?? 5));
    setCollaboratorAckWarnDays(String(cycle.collaborator_ack_warn_days ?? 3));
    setCollaboratorAckDangerDays(String(cycle.collaborator_ack_danger_days ?? 7));
    setEditingCycle(true);
  }

  function startNewCycle() {
    setCycleId("");
    setName("");
    setCollectStart("");
    setCollectEnd("");
    setReleaseStart("");
    setReleaseEnd("");
    setOneOnOneWarnDays("2");
    setOneOnOneDangerDays("5");
    setCollaboratorAckWarnDays("3");
    setCollaboratorAckDangerDays("7");
    setEditingCycle(true);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">RH - Governanca de Feedback</h1>
            <p className="mt-1 text-sm text-slate-600">
              Defina janelas de coleta/disponibilizacao e acompanhe feedbacks aplicados.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Periodo de feedback</h2>
        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Carregando configuracao do ciclo...</p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Configure o ciclo com datas de coleta e liberacao. Quando houver ciclo ativo, voce pode visualizar o resumo e clicar em editar para ajustar.
            </p>
            {!editingCycle ? (
              <>
                <div className="mt-4 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Novo ciclo de feedback</p>
                  <p className="mt-1 text-xs text-emerald-800">
                    Crie um novo ciclo para o proximo periodo. Ao salvar, o ciclo atual sera encerrado automaticamente.
                  </p>
                  <button
                    onClick={startNewCycle}
                    disabled={loading || deletingCycle || saving}
                    className="mt-3 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                  >
                    Incluir novo ciclo
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {cycleRows.length ? (
                    cycleRows.map((cycle, index) => {
                      const isOpen = expandedCycleId === cycle.id;
                      const isActive = cycle.active;
                      const hasActiveCycle = cycleRows.some((row) => row.active);
                      const isRh = actorRole === "rh";
                      const isAdmin = actorRole === "admin";
                      const cycleOpenNow =
                        isActive &&
                        Date.now() >= Date.parse(cycle.collect_start) &&
                        Date.now() <= Date.parse(cycle.release_end);
                      const canEdit = isAdmin || (isRh && cycleOpenNow);
                      const canDelete = isAdmin || (isRh && cycleOpenNow && Number(cycle.feedback_count ?? 0) === 0);
                      const canManage = isAdmin || isRh || isActive || (!hasActiveCycle && index === 0);
                      return (
                        <div
                          key={cycle.id}
                          className={`rounded-2xl border p-4 ${
                            isActive ? "border-sky-200 bg-sky-50/60" : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCycleId((prev) => (prev === cycle.id ? null : cycle.id))
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-100"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {isActive ? "Ciclo atual" : "Ciclo encerrado"}
                              </p>
                              <span className="text-xs font-semibold text-slate-600">
                                {isOpen ? "Ocultar detalhes" : "Ver detalhes"}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{cycle.name || "Ciclo sem nome"}</p>
                            <p className="mt-1 text-xs text-slate-600">
                              Coleta: {formatDateTime(cycle.collect_start)} ate {formatDateTime(cycle.collect_end)}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">
                              Feedbacks enviados: {Number(cycle.sent_feedback_count ?? 0)} / {totalCompanyCollaborators} colaboradores
                            </p>
                          </button>
                          {canManage ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => startEditCycle(cycle)}
                                disabled={loading || deletingCycle || !canEdit}
                                title={!canEdit && isRh ? "RH so pode editar ciclo em aberto e ativo." : undefined}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                              >
                                Editar ciclo
                              </button>
                              <button
                                onClick={() => {
                                  void deleteCycleAndFeedbacks(cycle.id);
                                }}
                                disabled={deletingCycle || loading || saving || !canDelete}
                                title={
                                  !canDelete && isRh
                                    ? Number(cycle.feedback_count ?? 0) > 0
                                      ? "RH so pode excluir ciclo sem feedbacks registrados."
                                      : "RH so pode excluir ciclo em aberto e ativo."
                                    : undefined
                                }
                                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
                              >
                                {deletingCycleId === cycle.id ? "Excluindo..." : "Excluir ciclo e feedbacks"}
                              </button>
                            </div>
                          ) : null}
                          {isOpen ? (
                            <>
                              <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                                <p>
                                  Liberacao: {formatDateTime(cycle.release_start)} ate{" "}
                                  {formatDateTime(cycle.release_end)}
                                </p>
                                <p>Alerta one-on-one: {cycle.one_on_one_warn_days} dia(s)</p>
                                <p>Crítico one-on-one: {cycle.one_on_one_danger_days} dia(s)</p>
                                <p>Alerta devolutiva: {cycle.collaborator_ack_warn_days} dia(s)</p>
                                <p>Crítico devolutiva: {cycle.collaborator_ack_danger_days} dia(s)</p>
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                      Nenhum ciclo de feedback cadastrado.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do ciclo (ex.: 1o Bimestre de 2026)"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 md:col-span-2"
              />
              <label className="text-xs text-slate-600">
                Coleta inicio
                <input
                  type="datetime-local"
                  value={collectStart}
                  onChange={(e) => setCollectStart(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-xs text-slate-600">
                Coleta fim
                <input
                  type="datetime-local"
                  value={collectEnd}
                  onChange={(e) => setCollectEnd(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-xs text-slate-600">
                Liberacao inicio
                <input
                  type="datetime-local"
                  value={releaseStart}
                  onChange={(e) => setReleaseStart(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-xs text-slate-600">
                Liberacao fim
                <input
                  type="datetime-local"
                  value={releaseEnd}
                  onChange={(e) => setReleaseEnd(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-600">
                Alerta one-on-one (dias)
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={oneOnOneWarnDays}
                  onChange={(e) => setOneOnOneWarnDays(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-xs text-slate-600">
                Crítico one-on-one (dias)
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={oneOnOneDangerDays}
                  onChange={(e) => setOneOnOneDangerDays(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-xs text-slate-600">
                Alerta devolutiva colaborador (dias)
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={collaboratorAckWarnDays}
                  onChange={(e) => setCollaboratorAckWarnDays(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="text-xs text-slate-600">
                Crítico devolutiva colaborador (dias)
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={collaboratorAckDangerDays}
                  onChange={(e) => setCollaboratorAckDangerDays(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void saveCycle()}
                disabled={saving || loading || deletingCycle}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar ciclo"}
              </button>
              {cycleId ? (
                <button
                  onClick={() => void load()}
                  disabled={saving || loading || deletingCycle}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  Cancelar edicao
                </button>
              ) : null}
              <button
                onClick={() => void deleteCycleAndFeedbacks()}
                disabled={deletingCycle || loading || saving || !cycleId}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                {deletingCycle ? "Excluindo..." : "Excluir ciclo e feedbacks"}
              </button>
            </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Feedbacks aplicados</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-slate-600">
            Departamento
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">Todos</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Colaborador
            <select
              value={collaboratorFilter}
              onChange={(e) => setCollaboratorFilter(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">Todos</option>
              {collaboratorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Gestor
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">Todos</option>
              {managerOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Periodo de feedback
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">Todos</option>
              {periodOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 space-y-3">
          {filteredRows.length ? (
            filteredRows.map((r) => (
              (() => {
                const oneOnOneWarn = Math.max(1, Number(oneOnOneWarnDays) || 2);
                const oneOnOneDanger = Math.max(oneOnOneWarn, Number(oneOnOneDangerDays) || 5);
                const ackWarn = Math.max(1, Number(collaboratorAckWarnDays) || 3);
                const ackDanger = Math.max(ackWarn, Number(collaboratorAckDangerDays) || 7);
                const oneOnOneDaysPending = r.one_on_one_completed_at ? 0 : daysPendingSince(r.created_at);
                const ackDaysPending =
                  r.one_on_one_completed_at && !r.acknowledged_at
                    ? daysPendingSince(r.one_on_one_completed_at)
                    : 0;
                return (
                  <div key={r.id} className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-sky-50/40 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:justify-between">
                      <div className="flex-1">
                        <p className="text-base font-semibold text-slate-900">
                          {displayName(r.target_name, "Colaborador")}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Ciclo: {r.cycle_name ?? "-"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${releaseClass(r.released_to_collaborator)}`}>
                            {r.released_to_collaborator ? "Liberado" : "Não liberado"}
                          </span>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classificationClass(r.final_classification)}`}>
                            {r.final_classification ?? "Sem classificacao"}
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              r.one_on_one_completed_at
                                ? "border-teal-200 bg-teal-50 text-teal-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {r.one_on_one_completed_at ? "One-on-one registrado" : "One-on-one pendente"}
                          </span>
                          {!r.one_on_one_completed_at ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pendingToneClass(oneOnOneDaysPending, oneOnOneWarn, oneOnOneDanger)}`}>
                              Pendente ha {oneOnOneDaysPending} dia(s)
                            </span>
                          ) : null}
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              r.acknowledged_at
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                            }`}
                          >
                            {r.acknowledged_at ? "Devolutiva confirmada" : "Aguardando confirmacao do colaborador"}
                          </span>
                          {r.one_on_one_completed_at && !r.acknowledged_at ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pendingToneClass(ackDaysPending, ackWarn, ackDanger)}`}>
                              Pendente ha {ackDaysPending} dia(s)
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">{r.comment ?? "-"}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Data: {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 md:min-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-14 rounded-full p-1" style={scoreRingStyle(r.final_score, r.final_classification)}>
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-900">
                              {r.final_score?.toFixed(1) ?? "-"}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500">Nota final</p>
                            <p className="text-sm font-semibold text-slate-900">{r.final_score?.toFixed(1) ?? "-"} / 10</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                          <p>
                            One-on-one:{" "}
                            {r.one_on_one_completed_at
                              ? new Date(r.one_on_one_completed_at).toLocaleDateString("pt-BR")
                              : `Pendente ha ${oneOnOneDaysPending} dia(s)`}
                          </p>
                          <p>
                            Devolutiva:{" "}
                            {r.acknowledged_at
                              ? new Date(r.acknowledged_at).toLocaleDateString("pt-BR")
                              : r.one_on_one_completed_at
                              ? `Pendente ha ${ackDaysPending} dia(s)`
                              : "Pendente"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setSelectedDetails(r)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        Ver detalhes
                      </button>
                      <button
                        onClick={() => void toggleRelease(r.id, true)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                      >
                        Liberar
                      </button>
                      <button
                        onClick={() => void toggleRelease(r.id, false)}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                      >
                        Ocultar
                      </button>
                    </div>
                  </div>
                );
              })()
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhum feedback encontrado para os filtros selecionados.
            </div>
          )}
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div>
      ) : null}

      {selectedDetails ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          onClick={() => setSelectedDetails(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-t-2xl border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Detalhes completos da avaliacao</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {displayName(selectedDetails.target_name, "Colaborador")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Avaliador: {displayName(selectedDetails.evaluator_name, "Avaliador")} | Perfil:{" "}
                    {formatSourceRole(selectedDetails.source_role)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetails(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  Nota final: {selectedDetails.final_score?.toFixed(1) ?? "-"}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${classificationClass(
                    selectedDetails.final_classification
                  )}`}
                >
                  Classificação: {selectedDetails.final_classification ?? "-"}
                </span>
                <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  Status: {formatFeedbackStatus(selectedDetails.status)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${releaseClass(
                    selectedDetails.released_to_collaborator
                  )}`}
                >
                  {selectedDetails.released_to_collaborator ? "Liberado ao colaborador" : "Não liberado ao colaborador"}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  Data: {new Date(selectedDetails.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    selectedDetails.one_on_one_completed_at
                      ? "border-teal-200 bg-teal-50 text-teal-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {selectedDetails.one_on_one_completed_at ? "One-on-one registrado" : "One-on-one pendente"}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    selectedDetails.acknowledged_at
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {selectedDetails.acknowledged_at ? "Colaborador confirmou devolutiva" : "Colaborador ainda não confirmou"}
                </span>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDetailTab("notas")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    detailTab === "notas"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <BarChart3 size={14} />
                  Notas
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("resultados")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    detailTab === "resultados"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Target size={14} />
                  Resultados
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("pdi")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    detailTab === "pdi"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <ListChecks size={14} />
                  PDI
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("devolutiva")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    detailTab === "devolutiva"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Target size={14} />
                  Devolutiva
                </button>
              </div>

              {detailTab === "notas" ? (
                <div className="tab-fade-in space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback principal</p>
                    <p className="mt-2 text-sm text-slate-800">{selectedDetails.comment ?? "-"}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-sky-700">Notas tecnicas</p>
                        <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                          Media: {technicalAvg?.toFixed(1) ?? "-"} / 5
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {detailTechnical.length ? (
                          detailTechnical.map((item) => (
                            <div key={`tech-${selectedDetails.id}-${item.label}`} className="rounded-lg border border-sky-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium text-slate-700">{prettifyLabel(item.label)}</p>
                                <p className="text-xs font-semibold text-sky-700">{formatScoreWithMax(item.value)}</p>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full bg-sky-100">
                                <div
                                  className="h-1.5 rounded-full bg-sky-500"
                                  style={{ width: `${Math.max(0, Math.min(100, (item.value / 5) * 100))}%` }}
                                />
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
                        <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                          Media: {behavioralAvg?.toFixed(1) ?? "-"} / 5
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {detailBehavioral.length ? (
                          detailBehavioral.map((item) => (
                            <div key={`beh-${selectedDetails.id}-${item.label}`} className="rounded-lg border border-violet-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium text-slate-700">{prettifyLabel(item.label)}</p>
                                <p className="text-xs font-semibold text-violet-700">{formatScoreWithMax(item.value)}</p>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full bg-violet-100">
                                <div
                                  className="h-1.5 rounded-full bg-violet-500"
                                  style={{ width: `${Math.max(0, Math.min(100, (item.value / 5) * 100))}%` }}
                                />
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
                <div className="tab-fade-in grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                    <p className="text-xs font-semibold text-indigo-700">Resultados e evolucao</p>
                    <div className="mt-3 space-y-2">
                      {[
                        { label: "Impacto no periodo", value: readTextField(selectedDetails.details_json, "impact_result") },
                        { label: "Evidencias apresentadas", value: readTextField(selectedDetails.details_json, "impact_evidence") },
                        { label: "Evolucao observada", value: readTextField(selectedDetails.details_json, "evolution_result") },
                        { label: "Mudanca percebida", value: readTextField(selectedDetails.details_json, "evolution_change") },
                        { label: "Resposta do avaliador", value: readTextField(selectedDetails.details_json, "final_message") },
                      ].map((item) => (
                        <div key={`res-${item.label}`} className="rounded-lg border border-indigo-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">{item.label}</p>
                          <p className="mt-1 text-sm text-slate-800">{item.value || "Não informado."}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold text-emerald-700">Sintese</p>
                    <div className="mt-3 space-y-2">
                      {[
                        { label: "Pontos fortes", value: readTextField(selectedDetails.details_json, "strengths") },
                        { label: "Pontos de desenvolvimento", value: readTextField(selectedDetails.details_json, "development_points") },
                        { label: "Resposta do avaliador", value: readTextField(selectedDetails.details_json, "final_message") },
                      ].map((item) => (
                        <div key={`syn-${item.label}`} className="rounded-lg border border-emerald-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{item.label}</p>
                          <p className="mt-1 text-sm text-slate-800">{item.value || "Não informado."}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {detailTab === "pdi" ? (
                <div className="tab-fade-in rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-700">Plano de desenvolvimento individual</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {readPdiItems(selectedDetails.details_json).length ? (
                      <div className="space-y-3 pt-1">
                        {readPdiItems(selectedDetails.details_json).map((item, index) => (
                          <div
                            key={`pdi-item-${selectedDetails.id}-${index}`}
                            className="rounded-lg border border-emerald-200 bg-white p-3"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Meta {index + 1}</p>
                            <div className="mt-2 grid gap-2 md:grid-cols-5">
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Objetivo</p>
                                <p className="mt-1 text-sm text-slate-800">{item.goal || "Não informado."}</p>
                              </div>
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Acao</p>
                                <p className="mt-1 text-sm text-slate-800">{item.action || "Não informado."}</p>
                              </div>
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Prazo</p>
                                <p className="mt-1 text-sm text-slate-800">{item.deadline || "Não informado."}</p>
                              </div>
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Responsavel</p>
                                <p className="mt-1 text-sm text-slate-800">{item.responsible || "Não informado."}</p>
                              </div>
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Indicador</p>
                                <p className="mt-1 text-sm text-slate-800">{item.indicator || "Não informado."}</p>
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
                            <p className="mt-1 text-sm text-slate-800">{readTextField(selectedDetails.details_json, "pdi_goal") || "Não informado."}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Acao</p>
                            <p className="mt-1 text-sm text-slate-800">{readTextField(selectedDetails.details_json, "pdi_action") || "Não informado."}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {detailTab === "devolutiva" ? (
                <div className="tab-fade-in grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                    <p className="text-xs font-semibold text-teal-700">One-on-one</p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg border border-teal-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Status</p>
                        <p className="mt-1 text-sm text-slate-800">
                          {selectedDetails.one_on_one_completed_at
                            ? `Registrado em ${new Date(selectedDetails.one_on_one_completed_at).toLocaleString("pt-BR")}`
                            : "Pendente"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-teal-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Responsavel registro</p>
                        <p className="mt-1 text-sm text-slate-800">
                          {selectedDetails.one_on_one_completed_by_name || "Não informado."}
                        </p>
                      </div>
                      <div className="rounded-lg border border-teal-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Anotacoes internas</p>
                        <p className="mt-1 text-sm text-slate-800">{selectedDetails.one_on_one_notes || "Não informado."}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold text-emerald-700">Devolutiva do colaborador</p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg border border-emerald-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Confirmacao de recebimento</p>
                        <p className="mt-1 text-sm text-slate-800">
                          {selectedDetails.acknowledged_at
                            ? `Confirmado em ${new Date(selectedDetails.acknowledged_at).toLocaleString("pt-BR")}`
                            : "Pendente"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Comentario do colaborador</p>
                        <p className="mt-1 text-sm text-slate-800">{selectedDetails.collaborator_comment || "Não informado."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <style jsx>{`
              .tab-fade-in {
                animation: tabFadeIn 0.18s ease-out;
              }
              @keyframes tabFadeIn {
                from {
                  opacity: 0;
                  transform: translateY(4px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>
          </div>
        </div>
      ) : null}
    </div>
  );
}

