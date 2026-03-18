"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSignature, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import DiretoriaPageHeader from "@/components/portal/DiretoriaPageHeader";

type ProjectRow = {
  id: string;
  name: string;
  budget_total: number | null;
  end_date: string | null;
  status: "active" | "paused" | "done";
};

type ContractEventType =
  | "aditivo_valor"
  | "prorrogacao_prazo"
  | "aditivo_escopo"
  | "notificacao"
  | "rescisao"
  | "outro";

type ContractEventStatus =
  | "registrado"
  | "em_analise"
  | "aprovado"
  | "rejeitado"
  | "executado"
  | "cancelado";

type ContractEventRow = {
  id: string;
  project_id: string;
  event_type: ContractEventType;
  status: ContractEventStatus;
  effective_date: string;
  title: string;
  description: string | null;
  additional_amount: number | null;
  from_budget_total: number | null;
  to_budget_total: number | null;
  from_end_date: string | null;
  to_end_date: string | null;
  notified_to: string | null;
  apply_on_approval: boolean;
  applied_to_project: boolean;
  requested_by: string | null;
  finance_decision_note: string | null;
  finance_decided_at: string | null;
  created_at: string;
};

type ContractAuditRow = {
  id: string;
  event_id: string;
  project_id: string;
  actor_user_id: string;
  actor_role: string | null;
  action_type:
    | "created"
    | "status_changed"
    | "finance_decision"
    | "applied_to_project"
    | "notification_dispatched"
    | "updated";
  status_from: string | null;
  status_to: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type MetadataSummaryItem = {
  label: string;
  value: string;
};

const AUDIT_SENSITIVE_KEYS = new Set([
  "cpf",
  "cnpj",
  "email",
  "telefone",
  "celular",
  "pix_key",
  "pix_bank",
  "bank_name",
  "agencia",
  "agency",
  "conta",
  "account",
  "conta_corrente",
  "documento",
  "document_number",
]);

function fmtMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function eventTypeLabel(value: ContractEventType) {
  if (value === "aditivo_valor") return "Aditivo de valor";
  if (value === "prorrogacao_prazo") return "Prorroga??o de prazo";
  if (value === "aditivo_escopo") return "Aditivo de escopo";
  if (value === "notificacao") return "Notifica??o";
  if (value === "rescisao") return "Rescisao";
  return "Outro";
}

function statusLabel(value: ContractEventStatus) {
  if (value === "registrado") return "Registrado";
  if (value === "em_analise") return "Em an?lise";
  if (value === "aprovado") return "Aprovado";
  if (value === "rejeitado") return "Rejeitado";
  if (value === "executado") return "Executado";
  return "Cancelado";
}

function statusClass(value: ContractEventStatus) {
  if (value === "aprovado" || value === "executado") return "bg-emerald-50 text-emerald-700";
  if (value === "em_analise" || value === "registrado") return "bg-amber-50 text-amber-700";
  if (value === "rejeitado") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function auditActionLabel(value: ContractAuditRow["action_type"]) {
  if (value === "created") return "Cria??o";
  if (value === "finance_decision") return "Decisao financeira";
  if (value === "applied_to_project") return "Aplicado no projeto";
  if (value === "status_changed") return "Mudanca de status";
  if (value === "notification_dispatched") return "Notifica??o enviada";
  return "Atualiza??o";
}

function summarizeAuditMetadata(metadata: Record<string, unknown> | null): MetadataSummaryItem[] {
  if (!metadata) return [];
  const items: MetadataSummaryItem[] = [];
  for (const [key, rawValue] of Object.entries(metadata)) {
    if (rawValue == null) continue;
    if (typeof rawValue === "object") continue;
    const value = String(rawValue).trim();
    if (!value) continue;
    items.push({
      label: key.replace(/_/g, " "),
      value: AUDIT_SENSITIVE_KEYS.has(key) ? "Informacao sensivel registrada" : value,
    });
  }
  return items.slice(0, 10);
}

export default function DiretoriaContratosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [events, setEvents] = useState<ContractEventRow[]>([]);
  const [auditRows, setAuditRows] = useState<ContractAuditRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});

  const [projectId, setProjectId] = useState("");
  const [eventType, setEventType] = useState<ContractEventType>("aditivo_valor");
  const [eventStatus, setEventStatus] = useState<ContractEventStatus>("registrado");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [toEndDate, setToEndDate] = useState("");
  const [notifiedTo, setNotifiedTo] = useState("");
  const [applyToProject, setApplyToProject] = useState(true);

  const [projectFilter, setProjectFilter] = useState<"all" | string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ContractEventType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ContractEventStatus>("all");
  const [selectedAuditEventId, setSelectedAuditEventId] = useState("");

  useEffect(() => {
    if (eventType === "aditivo_valor") {
      setEventStatus("em_analise");
      setApplyToProject(true);
    }
  }, [eventType]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [projectRes, eventRes, auditRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id,name,budget_total,end_date,status")
          .order("created_at", { ascending: false }),
        supabase
          .from("project_contract_events")
          .select("id,project_id,event_type,status,effective_date,title,description,additional_amount,from_budget_total,to_budget_total,from_end_date,to_end_date,notified_to,apply_on_approval,applied_to_project,requested_by,finance_decision_note,finance_decided_at,created_at")
          .order("effective_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("project_contract_event_audit")
          .select("id,event_id,project_id,actor_user_id,actor_role,action_type,status_from,status_to,notes,metadata,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (eventRes.error) throw eventRes.error;
      if (auditRes.error) throw auditRes.error;

      const nextProjects = (projectRes.data ?? []) as ProjectRow[];
      setProjects(nextProjects);
      const nextEvents = (eventRes.data ?? []) as ContractEventRow[];
      setEvents(nextEvents);
      const nextAudit = (auditRes.data ?? []) as ContractAuditRow[];
      setAuditRows(nextAudit);
      setProjectId((prev) => prev || nextProjects[0]?.id || "");
      setSelectedAuditEventId((prev) =>
        prev && nextEvents.some((e) => e.id === prev) ? prev : nextEvents[0]?.id || ""
      );

      const actorIds = Array.from(new Set(nextAudit.map((a) => a.actor_user_id).filter(Boolean)));
      if (actorIds.length) {
        const profRes = await supabase.from("profiles").select("id,full_name,email").in("id", actorIds);
        if (!profRes.error) {
          const map: Record<string, ProfileRow> = {};
          for (const p of (profRes.data ?? []) as ProfileRow[]) map[p.id] = p;
          setProfilesById(map);
        }
      } else {
        setProfilesById({});
      }
    } catch (e: unknown) {
      setProjects([]);
      setEvents([]);
      setAuditRows([]);
      setProfilesById({});
      setMsg(e instanceof Error ? e.message : "Erro ao carregar modulo de aditivos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const projectById = useMemo(() => {
    const map: Record<string, ProjectRow> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (projectFilter !== "all" && e.project_id !== projectFilter) return false;
      if (typeFilter !== "all" && e.event_type !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [events, projectFilter, typeFilter, statusFilter]);

  useEffect(() => {
    if (!filteredEvents.length) {
      setSelectedAuditEventId("");
      return;
    }
    if (selectedAuditEventId && filteredEvents.some((e) => e.id === selectedAuditEventId)) return;
    setSelectedAuditEventId(filteredEvents[0].id);
  }, [filteredEvents, selectedAuditEventId]);

  const selectedAuditEvent = useMemo(
    () => events.find((e) => e.id === selectedAuditEventId) ?? null,
    [events, selectedAuditEventId]
  );

  const selectedEventAuditRows = useMemo(
    () => auditRows.filter((a) => a.event_id === selectedAuditEventId),
    [auditRows, selectedAuditEventId]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthTotal = 0;
    let monthValue = 0;
    let pendingFinance = 0;
    let monthRescisao = 0;

    for (const e of events) {
      const d = new Date(e.effective_date);
      const inMonth = !Number.isNaN(d.getTime()) && d >= monthStart;
      if (inMonth) monthTotal += 1;
      if (inMonth && e.event_type === "rescisao") monthRescisao += 1;
      if (e.event_type === "aditivo_valor" && e.status === "em_analise") pendingFinance += 1;
      if (
        inMonth &&
        e.event_type === "aditivo_valor" &&
        (e.status === "aprovado" || e.status === "executado")
      ) {
        monthValue += Number(e.additional_amount) || 0;
      }
    }

    return { monthTotal, monthValue, pendingFinance, monthRescisao };
  }, [events]);

  async function registerEvent() {
    if (!projectId) return setMsg("Selecione o projeto.");
    if (!title.trim()) return setMsg("Informe um titulo do evento.");
    if (!effectiveDate) return setMsg("Informe a data de vigencia.");
    if (eventType === "aditivo_valor" && !additionalAmount.trim()) return setMsg("Informe o valor adicional.");
    if (eventType === "prorrogacao_prazo" && !toEndDate) return setMsg("Informe a nova data de prazo.");

    setSaving(true);
    setMsg("");
    try {
      const amount = additionalAmount.trim() ? Number(additionalAmount.replace(",", ".")) : NaN;
      const amountNumber = Number.isFinite(amount) && amount >= 0 ? amount : null;

      const res = await fetch("/api/diretoria/project-contract-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId,
          event_type: eventType,
          status: eventStatus,
          effective_date: effectiveDate,
          title: title.trim(),
          description: description.trim() || null,
          additional_amount: amountNumber,
          to_end_date: toEndDate || null,
          notified_to: notifiedTo.trim() || null,
          apply_on_approval: applyToProject,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao registrar evento contratual.");

      setTitle("");
      setDescription("");
      setAdditionalAmount("");
      setToEndDate("");
      setNotifiedTo("");
      setEventStatus("registrado");
      setMsg("Evento contratual registrado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar evento contratual.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <DiretoriaPageHeader
        icon={FileSignature}
        title="Diretoria - Aditivos e eventos contratuais"
        subtitle="Registre aditivos de valor, prorroga??es de prazo, notifica??es e rescis?es por projeto."
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        }
      />

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Eventos no mes" value={stats.monthTotal} />
        <StatCard label="Aditivos aprovados (mes)" value={fmtMoney(stats.monthValue)} />
        <StatCard label="Pendentes CEO" value={stats.pendingFinance} />
        <StatCard label="Rescisoes no mes" value={stats.monthRescisao} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Registrar evento contratual</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Projeto
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Selecione o projeto...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Tipo de evento
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as ContractEventType)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="aditivo_valor">Aditivo de valor</option>
              <option value="prorrogacao_prazo">Prorroga??o de prazo</option>
              <option value="aditivo_escopo">Aditivo de escopo</option>
              <option value="notificacao">Notifica??o</option>
              <option value="rescisao">Rescisao</option>
              <option value="outro">Outro</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select
              value={eventStatus}
              onChange={(e) => setEventStatus(e.target.value as ContractEventStatus)}
              disabled={eventType === "aditivo_valor"}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="registrado">Registrado</option>
              <option value="em_analise">Em an?lise</option>
              <option value="aprovado">Aprovado</option>
              <option value="rejeitado">Rejeitado</option>
              <option value="executado">Executado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Vigencia
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            Titulo
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aditivo contratual no valor de..."
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>

          {eventType === "aditivo_valor" ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Valor adicional (R$)
              <input
                value={additionalAmount}
                onChange={(e) => setAdditionalAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Ex: 15000"
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
          ) : null}

          {eventType === "prorrogacao_prazo" ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Novo prazo final
              <input
                type="date"
                value={toEndDate}
                onChange={(e) => setToEndDate(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
          ) : null}

          {(eventType === "notificacao" || eventType === "rescisao") ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Notificado para
              <input
                value={notifiedTo}
                onChange={(e) => setNotifiedTo(e.target.value)}
                placeholder="Ex: Cliente, juridico, gestor..."
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
          ) : null}

          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            Descricao
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do evento contratual."
              className="min-h-[96px] rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={applyToProject}
            onChange={(e) => setApplyToProject(e.target.checked)}
          />
          {eventType === "aditivo_valor"
            ? "Aplicar no projeto ap?s aprova??o financeira"
            : "Aplicar automaticamente no projeto (valor/prazo quando aplicavel)"}
        </label>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void registerEvent()}
            disabled={saving || loading}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Registrando..." : "Registrar evento"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Projeto
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Tipo
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | ContractEventType)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="aditivo_valor">Aditivo de valor</option>
              <option value="prorrogacao_prazo">Prorroga??o de prazo</option>
              <option value="aditivo_escopo">Aditivo de escopo</option>
              <option value="notificacao">Notifica??o</option>
              <option value="rescisao">Rescisao</option>
              <option value="outro">Outro</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | ContractEventStatus)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="registrado">Registrado</option>
              <option value="em_analise">Em an?lise</option>
              <option value="aprovado">Aprovado</option>
              <option value="rejeitado">Rejeitado</option>
              <option value="executado">Executado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Historico de eventos ({filteredEvents.length})</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Projeto</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descricao</th>
                <th className="p-3">Impacto</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>Carregando...</td>
                </tr>
              ) : filteredEvents.length ? (
                filteredEvents.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3">{e.effective_date}</td>
                    <td className="p-3">{projectById[e.project_id]?.name ?? "-"}</td>
                    <td className="p-3">{eventTypeLabel(e.event_type)}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{e.title}</div>
                      <div className="text-xs text-slate-500">{e.description || "-"}</div>
                    </td>
                    <td className="p-3 text-xs text-slate-700">
                      {e.additional_amount != null ? (
                        <div>+ {fmtMoney(Number(e.additional_amount) || 0)}</div>
                      ) : null}
                      {e.to_end_date ? (
                        <div>Prazo: {e.from_end_date || "-"} -&gt; {e.to_end_date}</div>
                      ) : null}
                      {e.notified_to ? <div>Notificado: {e.notified_to}</div> : null}
                      {e.event_type === "aditivo_valor" && e.finance_decided_at ? (
                        <div>Decisao financeira: {e.finance_decided_at}</div>
                      ) : null}
                      {e.finance_decision_note ? <div>Obs. CEO: {e.finance_decision_note}</div> : null}
                      <div>{e.applied_to_project ? "Aplicado no projeto" : "N?o aplicado automaticamente"}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(e.status)}`}>
                        {statusLabel(e.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>Nenhum evento contratual encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Auditoria detalhada</p>
          <select
            value={selectedAuditEventId}
            onChange={(e) => setSelectedAuditEventId(e.target.value)}
            className="h-10 min-w-[280px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          >
            {filteredEvents.map((e) => (
              <option key={e.id} value={e.id}>
                {e.effective_date} - {e.title}
              </option>
            ))}
          </select>
        </div>

        {selectedAuditEvent ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">{selectedAuditEvent.title}</p>
            <p className="text-xs text-slate-600">
              Projeto: {projectById[selectedAuditEvent.project_id]?.name ?? "-"} | Tipo: {eventTypeLabel(selectedAuditEvent.event_type)}
            </p>
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {selectedEventAuditRows.length ? (
            selectedEventAuditRows.map((a) => {
              const actor = profilesById[a.actor_user_id];
              const actorLabel = actor?.full_name || actor?.email || a.actor_user_id;
              return (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{auditActionLabel(a.action_type)}</p>
                    <p className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Por: {actorLabel} ({a.actor_role ?? "-"})
                  </p>
                  {a.status_from || a.status_to ? (
                    <p className="mt-1 text-xs text-slate-600">
                      Status: {a.status_from ?? "-"} -&gt; {a.status_to ?? "-"}
                    </p>
                  ) : null}
                  {a.notes ? <p className="mt-1 text-xs text-slate-700">{a.notes}</p> : null}
                  {summarizeAuditMetadata(a.metadata).length ? (
                    <div className="mt-2 space-y-1 rounded-lg bg-white p-2 text-[11px] text-slate-700">
                      {summarizeAuditMetadata(a.metadata).map((item) => (
                        <div key={`${a.id}-${item.label}`} className="flex flex-wrap gap-2">
                          <span className="font-semibold text-slate-900">{item.label}:</span>
                          <span>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-600">Sem trilha de auditoria para este evento.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
