"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CalendarClock, CalendarDays, Filter, Users, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Papa from "papaparse";

type Colaborador = {
  id: string;
  user_id: string | null;
  nome: string | null;
  is_active: boolean;
  empresa?: string | null;
  departamento?: string | null;
  setor?: string | null;
  department_id?: string | null;
};

type AllowanceHistoryRow = {
  id: string;
  user_id: string;
  collaborator_id: string | null;
  valid_from: string;
  valid_to: string;
  max_days: number | null;
  window_start: string | null;
  window_end: string | null;
  days_allowed: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

type AbsenceRequestRow = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number | null;
  reason: string | null;
  status: string;
  created_at: string;
  manager_comment?: string | null;
  decided_at?: string | null;
};

type AnyRow = Record<string, unknown>;

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function plusDaysISO(base: string, days: number) {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function diffDaysInclusiveLocal(start: string, end: string) {
  if (!start || !end || end < start) return 0;
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.max(1, Math.floor((e.getTime() - s.getTime()) / 86400000) + 1);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function csvValue(row: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const found = entries.find(([entryKey]) => normalizeText(entryKey) === normalizeText(key));
    if (found) return String(found[1] ?? "").trim();
  }
  return "";
}

function isTakenAbsence(request: Pick<AbsenceRequestRow, "end_date" | "manager_comment" | "reason">) {
  const marker = normalizeText(`${request.manager_comment ?? ""} ${request.reason ?? ""}`);
  if (marker.includes("ja tirada") || marker.includes("ja tirado") || marker.includes("efetivamente tirada")) return true;
  return request.end_date < todayISO();
}

function timingLabel(request: Pick<AbsenceRequestRow, "end_date" | "manager_comment" | "reason">) {
  return isTakenAbsence(request) ? "Ja tirada" : "Programada";
}

export default function RHAusenciasPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCollabId, setSelectedCollabId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [summaryQuery, setSummaryQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("todos");
  const [departmentFilter, setDepartmentFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedMany, setSelectedMany] = useState<Record<string, boolean>>({});

  const [windowStart, setWindowStart] = useState(todayISO());
  const [windowEnd, setWindowEnd] = useState(plusDaysISO(todayISO(), 30));
  const [daysAllowed, setDaysAllowed] = useState<number>(1);
  const [preApprovedReason, setPreApprovedReason] = useState("Ausencia previamente autorizada pelo gestor.");
  const [absenceTiming, setAbsenceTiming] = useState<"scheduled" | "taken">("scheduled");

  const [saving, setSaving] = useState(false);
  const [savingPreApproved, setSavingPreApproved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<AllowanceHistoryRow[]>([]);
  const [requests, setRequests] = useState<AbsenceRequestRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySaving, setHistorySaving] = useState(false);
  const [historyMsg, setHistoryMsg] = useState<string | null>(null);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editDays, setEditDays] = useState<number>(1);
  const [editActive, setEditActive] = useState(true);
  const [requestSavingId, setRequestSavingId] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [requestEditStart, setRequestEditStart] = useState("");
  const [requestEditEnd, setRequestEditEnd] = useState("");
  const [requestEditReason, setRequestEditReason] = useState("");
  const [requestEditTiming, setRequestEditTiming] = useState<"scheduled" | "taken">("scheduled");
  const [importingCsv, setImportingCsv] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(todayISO().slice(0, 7));

  async function loadCreatorNames(rows: AllowanceHistoryRow[]) {
    const creatorIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean))) as string[];
    if (!creatorIds.length) {
      setCreatorNames({});
      return;
    }

    const [profRes, collabRes] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").in("id", creatorIds),
      supabase.from("colaboradores").select("user_id,nome,email").in("user_id", creatorIds),
    ]);

    const map: Record<string, string> = {};

    if (!collabRes.error) {
      for (const c of (collabRes.data ?? []) as Array<{ user_id: string | null; nome: string | null; email: string | null }>) {
        const id = c.user_id;
        const name = (c.nome ?? "").trim();
        if (id && name && !name.includes("@")) map[id] = name;
      }
    }

    if (!profRes.error) {
      for (const p of (profRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        const name = (p.full_name ?? "").trim();
        if (name && !name.includes("@")) map[p.id] = name;
      }
    }

    setCreatorNames(map);
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setHistoryLoading(true);
      const [collabRes, histRes, requestsRes] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("*")
          .eq("is_active", true)
          .order("nome", { ascending: true }),
        supabase
          .from("absence_allowances")
          .select("id,user_id,collaborator_id,valid_from,valid_to,max_days,window_start,window_end,days_allowed,is_active,created_by,created_at,updated_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("absence_requests")
          .select("id,user_id,start_date,end_date,days_count,reason,status,created_at,manager_comment,decided_at")
          .order("created_at", { ascending: false }),
      ]);

      if (!alive) return;

      if (collabRes.error) {
        console.error("Erro ao carregar colaboradores:", collabRes.error.message);
        setColaboradores([]);
      } else {
        setColaboradores(
          ((collabRes.data ?? []) as AnyRow[]).map((row) => ({
            id: String(row.id ?? ""),
            user_id: typeof row.user_id === "string" ? row.user_id : null,
            nome: typeof row.nome === "string" ? row.nome : null,
            is_active: typeof row.is_active === "boolean" ? row.is_active : true,
            empresa: typeof row.empresa === "string" ? row.empresa : null,
            departamento: typeof row.departamento === "string" ? row.departamento : null,
            setor: typeof row.setor === "string" ? row.setor : null,
            department_id: typeof row.department_id === "string" ? row.department_id : null,
          })),
        );
      }

      if (histRes.error) {
        console.error("Erro ao carregar historico de liberacoes:", histRes.error.message);
        setHistory([]);
      } else {
        const rows = (histRes.data ?? []) as AllowanceHistoryRow[];
        setHistory(rows);
        await loadCreatorNames(rows);
      }

      if (requestsRes.error) {
        console.error("Erro ao carregar solicitacoes de ausencias:", requestsRes.error.message);
        setRequests([]);
      } else {
        setRequests((requestsRes.data ?? []) as AbsenceRequestRow[]);
      }

      setLoading(false);
      setHistoryLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const selected = useMemo(
    () => colaboradores.find((c) => c.id === selectedCollabId) ?? null,
    [colaboradores, selectedCollabId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colaboradores;
    return colaboradores.filter((c) => (c.nome ?? "").toLowerCase().includes(q));
  }, [colaboradores, query]);

  const companyOptions = useMemo(() => {
    const values = Array.from(new Set(colaboradores.map((c) => (c.empresa ?? "").trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [colaboradores]);

  const departmentOptions = useMemo(() => {
    const values = Array.from(
      new Set(colaboradores.map((c) => (c.departamento ?? c.setor ?? c.department_id ?? "").trim()).filter(Boolean)),
    );
    return values.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [colaboradores]);

  const selectedManyIds = useMemo(
    () => Object.entries(selectedMany).filter(([, v]) => v).map(([k]) => k),
    [selectedMany]
  );

  const allFilteredSelected = useMemo(() => {
    if (filtered.length === 0) return false;
    return filtered.every((c) => selectedMany[c.id]);
  }, [filtered, selectedMany]);

  const approvedDaysByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const request of requests) {
      if (request.status !== "approved") continue;
      map[request.user_id] = (map[request.user_id] ?? 0) + (Number(request.days_count ?? 0) || 0);
    }
    return map;
  }, [requests]);

  const takenDaysByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const request of requests) {
      if (request.status !== "approved") continue;
      if (!isTakenAbsence(request)) continue;
      map[request.user_id] = (map[request.user_id] ?? 0) + (Number(request.days_count ?? 0) || 0);
    }
    return map;
  }, [requests]);

  const latestAllowanceByUser = useMemo(() => {
    const map: Record<string, AllowanceHistoryRow> = {};
    for (const allowance of history) {
      if (!allowance.is_active) continue;
      if (!map[allowance.user_id]) map[allowance.user_id] = allowance;
    }
    return map;
  }, [history]);

  function absenceSummaryFor(collab: Colaborador) {
    const allowance = collab.user_id ? latestAllowanceByUser[collab.user_id] : null;
    const allowed = Number(allowance?.days_allowed ?? allowance?.max_days ?? 0) || 0;
    const used = collab.user_id ? approvedDaysByUser[collab.user_id] ?? 0 : 0;
    const taken = collab.user_id ? takenDaysByUser[collab.user_id] ?? 0 : 0;
    const scheduled = Math.max(0, used - taken);
    const requested = requests.filter((request) => request.user_id === collab.user_id && request.status !== "cancelled").length;
    const nextAbsence = requests
      .filter((request) => request.user_id === collab.user_id && request.status === "approved" && request.end_date >= todayISO())
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    return { allowed, used, taken, scheduled, requested, remaining: Math.max(0, allowed - used), nextAbsence };
  }

  const filteredSummary = useMemo(() => {
    const q = summaryQuery.trim().toLowerCase();
    return colaboradores.filter((collab) => {
      const nameMatches = !q || (collab.nome ?? "").toLowerCase().includes(q);
      const company = (collab.empresa ?? "").trim() || "Sem empresa";
      const department = (collab.departamento ?? collab.setor ?? collab.department_id ?? "").trim() || "Sem setor";
      const companyMatches = companyFilter === "todos" || company === companyFilter;
      const departmentMatches = departmentFilter === "todos" || department === departmentFilter;
      if (!collab.user_id) return nameMatches && companyMatches && departmentMatches && statusFilter === "todos";
      const hasStatus =
        statusFilter === "todos" || requests.some((request) => request.user_id === collab.user_id && request.status === statusFilter);
      return nameMatches && companyMatches && departmentMatches && hasStatus;
    });
  }, [colaboradores, companyFilter, departmentFilter, requests, statusFilter, summaryQuery]);

  function toggleAllFiltered() {
    setSelectedMany((prev) => {
      const next = { ...prev };
      const target = !allFilteredSelected;
      for (const c of filtered) next[c.id] = target;
      return next;
    });
  }

  function validateForm() {
    if (!windowStart || !windowEnd) return "Informe início e fim.";
    if (windowEnd < windowStart) return "A data final não pode ser menor que a inicial.";
    if (!daysAllowed || daysAllowed < 1) return "Dias liberados deve ser pelo menos 1.";
    return null;
  }

  function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    return aStart <= bEnd && bStart <= aEnd;
  }

  function validatePreApprovedTargets(targets: Colaborador[]) {
    const periodDays = diffDaysInclusiveLocal(windowStart, windowEnd);
    if (daysAllowed < periodDays) {
      return `O periodo informado possui ${periodDays} dia(s), mas foram liberados apenas ${daysAllowed}. Ajuste os dias liberados ou reduza o periodo.`;
    }

    const conflicts = targets.filter((collab) =>
      requests.some(
        (request) =>
          request.user_id === collab.user_id &&
          request.status !== "cancelled" &&
          periodsOverlap(windowStart, windowEnd, request.start_date, request.end_date),
      ),
    );

    if (conflicts.length) {
      const names = conflicts
        .slice(0, 3)
        .map((collab) => collab.nome ?? "Sem nome")
        .join(", ");
      return `Conflito de datas encontrado para ${names}${conflicts.length > 3 ? ` e mais ${conflicts.length - 3}` : ""}.`;
    }

    return null;
  }

  async function getCreatorId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  }

  // ✅ Payload compatível com seu schema (valid_from/valid_to NOT NULL)
  function buildAllowanceRow(params: {
    user_id: string;
    collaborator_id: string;
    created_by: string;
  }) {
    return {
      user_id: params.user_id,                // NOT NULL
      collaborator_id: params.collaborator_id,

      // colunas "novas"
      days_allowed: daysAllowed,
      window_start: windowStart,
      window_end: windowEnd,

      // colunas "legadas" NOT NULL
      valid_from: windowStart,
      valid_to: windowEnd,
      max_days: daysAllowed,

      created_by: params.created_by,
      is_active: true,
    };
  }

  async function handleLiberarIndividual() {
    setMessage(null);

    const err = validateForm();
    if (err) return setMessage(err);
    if (!selected) return setMessage("Selecione um colaborador.");
    if (!selected.user_id) return setMessage("Este colaborador não tem user_id vinculado.");

    setSaving(true);
    try {
      const creatorId = await getCreatorId();
      if (!creatorId) return setMessage("Sessão inválida. Faça login novamente.");

      const payload = buildAllowanceRow({
        user_id: selected.user_id,
        collaborator_id: selected.id,
        created_by: creatorId,
      });

      const { error } = await supabase.from("absence_allowances").insert(payload);

      if (error) return setMessage("Erro ao salvar: " + error.message);
      await fetch("/api/rh/ausencias/allowances/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowances: [payload] }),
      }).catch(() => null);
      await refreshHistory();
      setMessage("Liberação individual criada com sucesso ✅");
    } finally {
      setSaving(false);
    }
  }

  async function handleLiberarMassa() {
    setMessage(null);

    const err = validateForm();
    if (err) return setMessage(err);
    if (selectedManyIds.length === 0) return setMessage("Selecione pelo menos 1 colaborador.");

    const selectedRows = selectedManyIds
      .map((id) => colaboradores.find((c) => c.id === id))
      .filter(Boolean) as Colaborador[];

    const semUser = selectedRows.filter((c) => !c.user_id);
    if (semUser.length > 0) {
      return setMessage(`Alguns selecionados estão sem user_id (${semUser.length}).`);
    }

    setSaving(true);
    try {
      const creatorId = await getCreatorId();
      if (!creatorId) return setMessage("Sessão inválida. Faça login novamente.");

      const rows = selectedRows.map((c) =>
        buildAllowanceRow({
          user_id: c.user_id!,
          collaborator_id: c.id,
          created_by: creatorId,
        })
      );

      const { error } = await supabase.from("absence_allowances").insert(rows);

      if (error) return setMessage("Erro ao liberar em massa: " + error.message);
      await fetch("/api/rh/ausencias/allowances/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowances: rows }),
      }).catch(() => null);
      await refreshHistory();
      setMessage(`Liberação em massa criada para ${rows.length} colaborador(es) ✅`);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegistrarPreAprovada(mode: "individual" | "massa") {
    setMessage(null);

    const err = validateForm();
    if (err) return setMessage(err);

    const targets =
      mode === "individual"
        ? selected
          ? [selected]
          : []
        : (selectedManyIds
            .map((id) => colaboradores.find((c) => c.id === id))
            .filter(Boolean) as Colaborador[]);

    if (!targets.length) {
      return setMessage(mode === "individual" ? "Selecione um colaborador." : "Selecione pelo menos 1 colaborador.");
    }

    const semUser = targets.filter((c) => !c.user_id);
    if (semUser.length > 0) {
      return setMessage(`Alguns selecionados estao sem user_id (${semUser.length}).`);
    }

    const targetError = validatePreApprovedTargets(targets);
    if (targetError) return setMessage(targetError);

    setSavingPreApproved(true);
    try {
      const rows = targets.map((collab) => ({
        collaboratorId: collab.id,
        userId: collab.user_id,
        startDate: windowStart,
        endDate: windowEnd,
        daysAllowed,
        reason: preApprovedReason,
        alreadyTaken: absenceTiming === "taken",
      }));

      const response = await fetch("/api/rh/ausencias/pre-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = (await response.json()) as { created?: number; requests?: unknown[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "Erro ao registrar ausencias aprovadas.");

      if (Array.isArray(json.requests) && json.requests.length) {
        await fetch("/api/ausencias/requests/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approved", requests: json.requests }),
        }).catch(() => null);
      }

      await refreshHistory();
      await refreshRequests();
      setMessage(`Ausencia pre-aprovada registrada para ${json.created ?? targets.length} colaborador(es).`);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Erro ao registrar ausencias aprovadas.");
    } finally {
      setSavingPreApproved(false);
    }
  }

  async function handleImportPreApprovedCsv(file: File | null) {
    setImportMsg(null);
    if (!file) return;

    setImportingCsv(true);
    try {
      const parsed = await new Promise<Papa.ParseResult<Record<string, unknown>>>((resolve, reject) => {
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject,
        });
      });

      const errors: string[] = [];
      const collabByName = new Map(colaboradores.map((collab) => [normalizeText(collab.nome ?? ""), collab]));
      const rows = parsed.data
        .map((raw, index) => {
          const line = index + 2;
          const name = csvValue(raw, ["colaborador", "nome", "nome do colaborador"]);
          const startDate = csvValue(raw, ["inicio", "início", "data inicio", "data início", "start"]);
          const endDate = csvValue(raw, ["fim", "data fim", "end"]);
          const reason = csvValue(raw, ["motivo", "observacao", "observação"]);
          const daysText = csvValue(raw, ["dias", "dias liberados"]);
          const timingText = normalizeText(csvValue(raw, ["situacao", "situação", "status do periodo", "periodo"]));
          const collab = collabByName.get(normalizeText(name));

          if (!name || !startDate || !endDate) {
            errors.push(`Linha ${line}: informe colaborador, inicio e fim.`);
            return null;
          }
          if (!collab || !collab.user_id) {
            errors.push(`Linha ${line}: colaborador nao encontrado ou sem acesso ao portal.`);
            return null;
          }
          if (endDate < startDate) {
            errors.push(`Linha ${line}: data final menor que a inicial.`);
            return null;
          }

          const periodDays = diffDaysInclusiveLocal(startDate, endDate);
          const days = Number(daysText.replace(",", ".")) || periodDays;
          if (days < periodDays) {
            errors.push(`Linha ${line}: dias liberados menor que o periodo.`);
            return null;
          }

          const conflict = requests.some(
            (request) =>
              request.user_id === collab.user_id &&
              request.status !== "cancelled" &&
              periodsOverlap(startDate, endDate, request.start_date, request.end_date),
          );
          if (conflict) {
            errors.push(`Linha ${line}: conflito de datas para ${collab.nome ?? name}.`);
            return null;
          }

          return {
            collaboratorId: collab.id,
            userId: collab.user_id,
            startDate,
            endDate,
            daysAllowed: days,
            reason: reason || "Ausencia previamente autorizada pelo gestor.",
            alreadyTaken: timingText.includes("tirad") || timingText.includes("realizad"),
          };
        })
        .filter(Boolean);

      if (errors.length) {
        setImportMsg(errors.slice(0, 5).join(" "));
        return;
      }
      if (!rows.length) {
        setImportMsg("Nenhuma linha valida encontrada no arquivo.");
        return;
      }

      const response = await fetch("/api/rh/ausencias/pre-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = (await response.json()) as { created?: number; requests?: unknown[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "Erro ao importar ausencias.");

      if (Array.isArray(json.requests) && json.requests.length) {
        await fetch("/api/ausencias/requests/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approved", requests: json.requests }),
        }).catch(() => null);
      }

      await refreshHistory();
      await refreshRequests();
      setImportMsg(`Importacao concluida: ${json.created ?? rows.length} ausencia(s) aprovada(s).`);
    } catch (e: unknown) {
      setImportMsg(e instanceof Error ? e.message : "Erro ao importar arquivo.");
    } finally {
      setImportingCsv(false);
    }
  }

  async function refreshHistory() {
    setHistoryLoading(true);
    setHistoryMsg(null);
    try {
      const { data, error } = await supabase
        .from("absence_allowances")
        .select("id,user_id,collaborator_id,valid_from,valid_to,max_days,window_start,window_end,days_allowed,is_active,created_by,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as AllowanceHistoryRow[];
      setHistory(rows);
      await loadCreatorNames(rows);
    } catch (e: unknown) {
      setHistoryMsg(e instanceof Error ? e.message : "Erro ao carregar historico.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function refreshRequests() {
    const { data, error } = await supabase
      .from("absence_requests")
      .select("id,user_id,start_date,end_date,days_count,reason,status,created_at,manager_comment,decided_at")
      .order("created_at", { ascending: false });
    if (!error) setRequests((data ?? []) as AbsenceRequestRow[]);
  }

  function startRequestEdit(row: AbsenceRequestRow) {
    setEditingRequestId(row.id);
    setRequestEditStart(row.start_date.slice(0, 10));
    setRequestEditEnd(row.end_date.slice(0, 10));
    setRequestEditReason(row.reason ?? "");
    setRequestEditTiming(isTakenAbsence(row) ? "taken" : "scheduled");
    setHistoryMsg(null);
  }

  function cancelRequestEdit() {
    setEditingRequestId(null);
    setHistoryMsg(null);
  }

  async function saveRequestEdit(row: AbsenceRequestRow) {
    if (!requestEditStart || !requestEditEnd) return setHistoryMsg("Informe inicio e fim da ausencia.");
    if (requestEditEnd < requestEditStart) return setHistoryMsg("Data final menor que a inicial.");

    const conflict = requests.some(
      (request) =>
        request.id !== row.id &&
        request.user_id === row.user_id &&
        request.status !== "cancelled" &&
        periodsOverlap(requestEditStart, requestEditEnd, request.start_date, request.end_date),
    );
    if (conflict) return setHistoryMsg("Ja existe ausencia registrada para este colaborador nesse periodo.");

    setRequestSavingId(row.id);
    setHistoryMsg(null);
    try {
      const days = diffDaysInclusiveLocal(requestEditStart, requestEditEnd);
      const { error } = await supabase
        .from("absence_requests")
        .update({
          start_date: requestEditStart,
          end_date: requestEditEnd,
          days_count: days,
          reason: requestEditReason,
          manager_comment:
            requestEditTiming === "taken"
              ? "Autorizacao previa registrada pelo RH. Periodo ja tirado pelo colaborador."
              : "Autorizacao previa registrada pelo RH. Periodo programado.",
        })
        .eq("id", row.id);
      if (error) throw error;
      setEditingRequestId(null);
      setHistoryMsg("Ausencia aprovada atualizada com sucesso.");
      await refreshRequests();
    } catch (e: unknown) {
      setHistoryMsg(e instanceof Error ? e.message : "Erro ao atualizar ausencia.");
    } finally {
      setRequestSavingId(null);
    }
  }

  async function cancelApprovedRequest(row: AbsenceRequestRow) {
    if (!window.confirm("Cancelar esta ausencia aprovada?")) return;
    setRequestSavingId(row.id);
    setHistoryMsg(null);
    try {
      const { error } = await supabase
        .from("absence_requests")
        .update({ status: "cancelled", manager_comment: "Cancelada pelo RH." })
        .eq("id", row.id);
      if (error) throw error;
      setHistoryMsg("Ausencia cancelada com sucesso.");
      await refreshRequests();
    } catch (e: unknown) {
      setHistoryMsg(e instanceof Error ? e.message : "Erro ao cancelar ausencia.");
    } finally {
      setRequestSavingId(null);
    }
  }

  function startEdit(row: AllowanceHistoryRow) {
    setEditingId(row.id);
    setEditStart((row.window_start ?? row.valid_from ?? "").slice(0, 10));
    setEditEnd((row.window_end ?? row.valid_to ?? "").slice(0, 10));
    setEditDays(Number(row.days_allowed ?? row.max_days ?? 1) || 1);
    setEditActive(!!row.is_active);
    setHistoryMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setHistoryMsg(null);
  }

  async function saveHistoryEdit(id: string) {
    if (!editStart || !editEnd) return setHistoryMsg("Informe inicio e fim.");
    if (editEnd < editStart) return setHistoryMsg("Data final menor que a inicial.");
    if (!editDays || editDays < 1) return setHistoryMsg("Dias liberados deve ser >= 1.");

    setHistorySaving(true);
    setHistoryMsg(null);
    try {
      const { error } = await supabase
        .from("absence_allowances")
        .update({
          window_start: editStart,
          window_end: editEnd,
          days_allowed: editDays,
          valid_from: editStart,
          valid_to: editEnd,
          max_days: editDays,
          is_active: editActive,
        })
        .eq("id", id);
      if (error) throw error;
      const target = history.find((h) => h.id === id);
      if (target) {
        await fetch("/api/rh/ausencias/allowances/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: editActive ? "updated" : "deactivated",
            allowances: [
              {
                user_id: target.user_id,
                collaborator_id: target.collaborator_id,
                valid_from: editStart,
                valid_to: editEnd,
                max_days: editDays,
                window_start: editStart,
                window_end: editEnd,
                days_allowed: editDays,
              },
            ],
          }),
        }).catch(() => null);
      }
      setEditingId(null);
      setHistoryMsg("Liberacao atualizada com sucesso.");
      await refreshHistory();
    } catch (e: unknown) {
      setHistoryMsg(e instanceof Error ? e.message : "Erro ao atualizar liberacao.");
    } finally {
      setHistorySaving(false);
    }
  }

  async function deleteHistory(id: string) {
    if (!window.confirm("Excluir esta liberacao?")) return;
    setHistorySaving(true);
    setHistoryMsg(null);
    try {
      const { error } = await supabase.from("absence_allowances").delete().eq("id", id);
      if (error) throw error;
      const target = history.find((h) => h.id === id);
      if (target) {
        await fetch("/api/rh/ausencias/allowances/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deleted",
            allowances: [
              {
                user_id: target.user_id,
                collaborator_id: target.collaborator_id,
                valid_from: target.window_start ?? target.valid_from,
                valid_to: target.window_end ?? target.valid_to,
                max_days: target.days_allowed ?? target.max_days ?? 0,
                window_start: target.window_start ?? target.valid_from,
                window_end: target.window_end ?? target.valid_to,
                days_allowed: target.days_allowed ?? target.max_days ?? 0,
              },
            ],
          }),
        }).catch(() => null);
      }
      if (editingId === id) setEditingId(null);
      setHistoryMsg("Liberacao excluida com sucesso.");
      await refreshHistory();
    } catch (e: unknown) {
      setHistoryMsg(e instanceof Error ? e.message : "Erro ao excluir liberacao.");
    } finally {
      setHistorySaving(false);
    }
  }

  function fmtDate(iso: string) {
    if (!iso) return "-";
    const [y, m, d] = iso.slice(0, 10).split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  function fmtDateTime(iso: string | null | undefined) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR");
  }

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      approved: "Aprovada",
      pending_manager: "Pendente",
      rejected: "Recusada",
      cancelled: "Cancelada",
    };
    return labels[status] ?? status;
  }

  function statusClass(status: string) {
    if (status === "approved") return "bg-emerald-50 text-emerald-700";
    if (status === "rejected") return "bg-rose-50 text-rose-700";
    if (status === "cancelled") return "bg-slate-100 text-slate-600";
    return "bg-amber-50 text-amber-700";
  }

  const approvedRequests = useMemo(
    () => requests.filter((request) => request.status === "approved").sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [requests],
  );

  const calendarRequests = useMemo(
    () =>
      approvedRequests.filter(
        (request) => request.start_date.slice(0, 7) === calendarMonth || request.end_date.slice(0, 7) === calendarMonth,
      ),
    [approvedRequests, calendarMonth],
  );

  const colaboradorNomeByRef = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of colaboradores) {
      const nome = (c.nome ?? "").trim() || "Colaborador sem nome";
      map[c.id] = nome;
      if (c.user_id) map[c.user_id] = nome;
    }
    return map;
  }, [colaboradores]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Gerenciador de ausências (RH)</h1>
        <p className="mt-1 text-sm text-slate-600">Defina limites de solicitação por colaborador.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Colaboradores" value={loading ? "…" : String(colaboradores.length)} icon={Users} />
        <KpiCard label="Liberações" value={historyLoading ? "…" : String(history.length)} icon={CalendarClock} />
        <KpiCard label="Solicitações" value={loading ? "…" : String(requests.length)} icon={Wand2} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Resumo e filtros</p>
            <p className="mt-1 text-sm text-slate-600">
              Acompanhe dias liberados, programados e saldo por colaborador.
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <Filter size={18} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <input
            value={summaryQuery}
            onChange={(e) => setSummaryQuery(e.target.value)}
            placeholder="Buscar colaborador"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="todos">Todas as empresas</option>
            {companyOptions.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="todos">Todos os setores</option>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            <option value="todos">Todos os status</option>
            <option value="pending_manager">Pendentes</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Recusadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Empresa/Setor</th>
                <th className="p-3">Dias liberados</th>
                <th className="p-3">Programado</th>
                <th className="p-3">Ja tirado</th>
                <th className="p-3">Saldo</th>
                <th className="p-3">Proxima ausencia</th>
                <th className="p-3">Solicitacoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-3 text-slate-500">Nenhum colaborador encontrado nos filtros.</td>
                </tr>
              ) : (
                filteredSummary.slice(0, 12).map((collab) => {
                  const summary = absenceSummaryFor(collab);
                  const department = collab.departamento ?? collab.setor ?? "Sem setor";
                  return (
                    <tr key={collab.id} className="border-t">
                      <td className="p-3 font-medium text-slate-900">{collab.nome ?? "Sem nome"}</td>
                      <td className="p-3 text-slate-600">
                        {(collab.empresa ?? "Sem empresa")} · {department}
                      </td>
                      <td className="p-3">{summary.allowed}</td>
                      <td className="p-3">{summary.scheduled}</td>
                      <td className="p-3">{summary.taken}</td>
                      <td className={`p-3 font-semibold ${summary.remaining <= 0 && summary.allowed > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        {summary.remaining}
                      </td>
                      <td className="p-3 text-slate-600">
                        {summary.nextAbsence ? `${fmtDate(summary.nextAbsence.start_date)} ate ${fmtDate(summary.nextAbsence.end_date)}` : "-"}
                      </td>
                      <td className="p-3">{summary.requested}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredSummary.length > 12 ? (
          <p className="mt-3 text-xs text-slate-500">Mostrando 12 de {filteredSummary.length}. Use os filtros para refinar a lista.</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Liberar dias para solicitação</p>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Individual: só nome */}
          <div>
            <label className="text-sm font-semibold text-slate-900">Colaborador (individual)</label>
            <select
              value={selectedCollabId}
              onChange={(e) => setSelectedCollabId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">{loading ? "Carregando..." : "Selecione um colaborador"}</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome ?? "Sem nome"}
                </option>
              ))}
            </select>
          </div>

          {/* Massa: só nome */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <label className="text-sm font-semibold text-slate-900">Colaboradores (em massa)</label>
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="text-xs font-semibold text-slate-700 hover:underline"
              >
                {allFilteredSelected ? "Desmarcar filtrados" : "Marcar filtrados"}
              </button>
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome…"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />

            <div className="mt-3 max-h-[220px] overflow-auto rounded-xl border border-slate-200">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Nenhum colaborador encontrado.</div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {filtered.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={!!selectedMany[c.id]}
                        onChange={(e) =>
                          setSelectedMany((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                        className="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{c.nome ?? "Sem nome"}</p>
                        {(() => {
                          const summary = absenceSummaryFor(c);
                          return (
                            <p className="mt-0.5 text-xs text-slate-500">
                              Liberado: {summary.allowed} dia(s) · Programado: {summary.scheduled} · Ja tirado: {summary.taken} · Restante: {summary.remaining}
                            </p>
                          );
                        })()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Selecionados: <span className="font-semibold">{selectedManyIds.length}</span>
            </div>
          </div>
        </div>

        {/* Regras */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-semibold">Início</label>
            <input
              type="date"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Fim</label>
            <input
              type="date"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Dias liberados</label>
            <input
              type="number"
              min={1}
              value={daysAllowed}
              onChange={(e) => setDaysAllowed(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr,auto] lg:items-end">
            <div>
              <label className="text-sm font-semibold text-slate-900">Motivo/observação para ausência já autorizada</label>
              <input
                value={preApprovedReason}
                onChange={(e) => setPreApprovedReason(e.target.value)}
                placeholder="Ex.: ausência previamente autorizada pelo gestor"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                Use quando já houve autorização prévia do gestor/parceiro. O RH registra e aprova direto, carregando no perfil do colaborador.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAbsenceTiming("scheduled")}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    absenceTiming === "scheduled"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Periodo programado
                </button>
                <button
                  type="button"
                  onClick={() => setAbsenceTiming("taken")}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    absenceTiming === "taken"
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  Ja foi tirado
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
              Período: <b>{fmtDate(windowStart)}</b> até <b>{fmtDate(windowEnd)}</b>
              <br />
              Dias do período: <b>{diffDaysInclusiveLocal(windowStart, windowEnd)}</b>
              <br />
              Situacao: <b>{absenceTiming === "taken" ? "Ja tirado" : "Programado"}</b>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleLiberarIndividual}
            disabled={!selectedCollabId || saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Liberar individual"}
          </button>

          <button
            onClick={() => void handleRegistrarPreAprovada("individual")}
            disabled={!selectedCollabId || savingPreApproved}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingPreApproved ? "Registrando..." : "Registrar e aprovar individual"}
          </button>

          <button
            onClick={handleLiberarMassa}
            disabled={selectedManyIds.length === 0 || saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Liberar em massa"}
          </button>

          <button
            onClick={() => void handleRegistrarPreAprovada("massa")}
            disabled={selectedManyIds.length === 0 || savingPreApproved}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
          >
            {savingPreApproved ? "Registrando..." : "Registrar e aprovar em massa"}
          </button>

          {message && <span className="text-sm text-slate-700">{message}</span>}
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr,auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-900">Importacao em massa por CSV</p>
              <p className="mt-1 text-xs text-slate-500">
                Colunas aceitas: colaborador, inicio, fim, dias, motivo e situacao. Use "ja tirado" na situacao quando o periodo ja foi gozado.
              </p>
              {importMsg ? <p className="mt-2 text-sm text-slate-700">{importMsg}</p> : null}
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
              {importingCsv ? "Importando..." : "Importar CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={importingCsv}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void handleImportPreApprovedCsv(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Ausencias aprovadas pelo RH</p>
            <p className="mt-1 text-sm text-slate-600">
              Edite ou cancele registros previamente autorizados antes de eles impactarem o saldo do colaborador.
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
            <CalendarDays size={18} />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Periodo</th>
                <th className="p-3">Dias</th>
                <th className="p-3">Situacao</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Status</th>
                <th className="p-3">Observacao</th>
                <th className="p-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {approvedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-3 text-slate-500">Nenhuma ausencia aprovada encontrada.</td>
                </tr>
              ) : (
                approvedRequests.slice(0, 20).map((request) => {
                  const isEditing = editingRequestId === request.id;
                  const isPreApproved = (request.manager_comment ?? "").toLowerCase().includes("rh");
                  return (
                    <tr key={request.id} className="border-t align-top">
                      <td className="p-3 font-medium text-slate-900">
                        {colaboradorNomeByRef[request.user_id] ?? "Colaborador sem nome"}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="date"
                              value={requestEditStart}
                              onChange={(e) => setRequestEditStart(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                            <input
                              type="date"
                              value={requestEditEnd}
                              onChange={(e) => setRequestEditEnd(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          </div>
                        ) : (
                          <span>{fmtDate(request.start_date)} ate {fmtDate(request.end_date)}</span>
                        )}
                      </td>
                      <td className="p-3">{isEditing ? diffDaysInclusiveLocal(requestEditStart, requestEditEnd) : request.days_count ?? "-"}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={requestEditTiming}
                            onChange={(e) => setRequestEditTiming(e.target.value as "scheduled" | "taken")}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          >
                            <option value="scheduled">Programada</option>
                            <option value="taken">Ja tirada</option>
                          </select>
                        ) : (
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            isTakenAbsence(request) ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                          }`}>
                            {timingLabel(request)}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                          {isPreApproved ? "Pre-aprovada RH" : "Fluxo normal"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass(request.status)}`}>
                          {statusLabel(request.status)}
                        </span>
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            value={requestEditReason}
                            onChange={(e) => setRequestEditReason(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                        ) : (
                          <span className="text-slate-600">{request.reason ?? "-"}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void saveRequestEdit(request)}
                              disabled={requestSavingId === request.id}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelRequestEdit}
                              disabled={requestSavingId === request.id}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                              Fechar
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startRequestEdit(request)}
                              disabled={requestSavingId === request.id}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void cancelApprovedRequest(request)}
                              disabled={requestSavingId === request.id}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Calendario RH</p>
              <p className="mt-1 text-xs text-slate-500">Visao rapida das ausencias aprovadas no mes selecionado.</p>
            </div>
            <input
              type="month"
              value={calendarMonth}
              onChange={(e) => setCalendarMonth(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {calendarRequests.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">
                Nenhuma ausencia aprovada neste mes.
              </div>
            ) : (
              calendarRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <p className="font-semibold text-slate-900">{colaboradorNomeByRef[request.user_id] ?? "Colaborador sem nome"}</p>
                  <p className="mt-1 text-slate-600">{fmtDate(request.start_date)} ate {fmtDate(request.end_date)}</p>
                  <p className="mt-1 text-xs text-slate-500">{request.days_count ?? diffDaysInclusiveLocal(request.start_date, request.end_date)} dia(s)</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Historico de liberacoes</p>
            <p className="mt-1 text-sm text-slate-600">
              Consulte, edite e exclua liberacoes realizadas pelo RH (com auditoria de quem e quando).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshHistory()}
            disabled={historyLoading || historySaving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            {historyLoading ? "Atualizando..." : "Atualizar historico"}
          </button>
        </div>

        {historyMsg ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {historyMsg}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Janela</th>
                <th className="p-3">Dias</th>
                <th className="p-3">Status</th>
                <th className="p-3">Criado por</th>
                <th className="p-3">Criado em</th>
                <th className="p-3">Atualizado em</th>
                <th className="p-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={8} className="p-3 text-slate-500">Carregando historico...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-3 text-slate-500">Nenhuma liberacao encontrada.</td>
                </tr>
              ) : (
                history.map((r) => {
                  const isEditing = editingId === r.id;
                  const start = (r.window_start ?? r.valid_from ?? "").slice(0, 10);
                  const end = (r.window_end ?? r.valid_to ?? "").slice(0, 10);
                  const days = Number(r.days_allowed ?? r.max_days ?? 0) || 0;
                  const collabName =
                    (r.collaborator_id && colaboradorNomeByRef[r.collaborator_id]) ||
                    colaboradorNomeByRef[r.user_id] ||
                    "Colaborador sem nome";
                  const creatorName =
                    (r.created_by && creatorNames[r.created_by]) ||
                    (r.created_by ? "Usuario nao identificado" : "-");

                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-3 font-medium text-slate-900">{collabName}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="date"
                              value={editStart}
                              onChange={(e) => setEditStart(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                            <input
                              type="date"
                              value={editEnd}
                              onChange={(e) => setEditEnd(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          </div>
                        ) : (
                          <span>{fmtDate(start)} ate {fmtDate(end)}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            value={editDays}
                            onChange={(e) => setEditDays(Number(e.target.value))}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                        ) : (
                          days
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={editActive}
                              onChange={(e) => setEditActive(e.target.checked)}
                            />
                            Ativa
                          </label>
                        ) : (
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {r.is_active ? "Ativa" : "Inativa"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-700">{creatorName}</td>
                      <td className="p-3 text-slate-700">{fmtDateTime(r.created_at)}</td>
                      <td className="p-3 text-slate-700">{fmtDateTime(r.updated_at)}</td>
                      <td className="p-3">
                        <div className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 p-2">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Acoes da liberacao
                          </div>
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void saveHistoryEdit(r.id)}
                              disabled={historySaving}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={historySaving}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteHistory(r.id)}
                              disabled={historySaving}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(r)}
                              disabled={historySaving}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteHistory(r.id)}
                              disabled={historySaving}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

