"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FolderPlus } from "lucide-react";
import DiretoriaPageHeader from "@/components/portal/DiretoriaPageHeader";

type ProjectType =
  | "hv"
  | "rmt"
  | "basico"
  | "estrutural"
  | "civil"
  | "bim"
  | "eletromecanico"
  | "eletrico"
  | "hidraulico"
  | "outro";
type ProjectLine = "eolica" | "solar" | "bess";
type ProjectModality = "basico" | "executivo" | "eng_proprietario" | "consultoria";
type ProjectStatus = "active" | "paused" | "done";
type ProjectStage = "ofertas" | "desenvolvimento" | "as_built" | "pausado" | "cancelado";
type DeliverableDiscipline = "civil" | "bim" | "eletromecanico";

type ProjectClientRow = {
  id: string;
  name: string;
};

type CompanyRow = {
  id: string;
  name: string;
};

type ManagerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ExistingProjectRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_total: number | null;
  client_id: string | null;
  project_type: string | null;
  project_line?: ProjectLine | null;
  project_scopes: string[] | null;
  project_stage: ProjectStage | null;
  status: ProjectStatus;
  owner_user_id: string;
  created_at: string;
};

type DeliverableDraftItem = {
  temp_id: string;
  title: string;
  description: string;
  due_date: string;
  discipline_code: DeliverableDiscipline | "";
  currency_code: "BRL" | "USD" | "EUR";
  actual_amount: string;
};

type ProjectDeliverableLiteRow = {
  id: string;
  project_id: string;
  title: string | null;
  description: string | null;
  due_date: string | null;
  status: string | null;
  discipline_code: DeliverableDiscipline | null;
  currency_code: string | null;
  budget_amount: number | null;
  actual_amount: number | null;
  financial_status?: "aberto" | "pendente" | "baixado" | null;
};

type DeliverableAssigneeRow = {
  deliverable_id: string;
  contribution_unit: "hours" | "percent" | "points" | null;
  contribution_value: number | null;
};

type DeliverableValueDraft = {
  title?: string;
  discipline_code?: DeliverableDiscipline;
  currency_code: "BRL" | "USD" | "EUR";
  actual_amount: string;
  due_date?: string;
};

type DeliverableResidualPrompt = {
  project_id: string;
  deliverable_id: string;
  residual_amount: number;
  candidate_ids: string[];
  phase: "ask" | "select";
  selected_ids: string[];
};

type ProjectDraft = {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  budget_total: string;
  client_id: string;
  project_type: ProjectModality | "";
  project_line: ProjectLine | "";
  project_scopes: ProjectType[];
  project_stage: ProjectStage;
  owner_user_id: string;
  secondary_manager_user_ids: string[];
};

const PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType; label: string }> = [
  { value: "hv", label: "HV" },
  { value: "rmt", label: "RMT" },
  { value: "basico", label: "Basico" },
  { value: "estrutural", label: "Estrutural" },
  { value: "civil", label: "Civil" },
  { value: "bim", label: "BIM" },
  { value: "eletromecanico", label: "Eletromecanico" },
  { value: "eletrico", label: "Eletrico" },
  { value: "hidraulico", label: "Hidraulico" },
  { value: "outro", label: "Outro" },
];

const PROJECT_LINE_OPTIONS: Array<{ value: ProjectLine; label: string }> = [
  { value: "eolica", label: "Eolica" },
  { value: "solar", label: "Solar" },
  { value: "bess", label: "BESS" },
];

const PROJECT_MODALITY_OPTIONS: Array<{ value: ProjectModality; label: string }> = [
  { value: "basico", label: "Basico" },
  { value: "executivo", label: "Executivo" },
  { value: "eng_proprietario", label: "Eng. do proprietario" },
  { value: "consultoria", label: "Consultoria" },
];

const PROJECT_SCOPE_OPTIONS_DIRETORIA = PROJECT_TYPE_OPTIONS.filter(
  (opt) => opt.value === "civil" || opt.value === "bim" || opt.value === "eletromecanico"
);

const DELIVERABLE_DISCIPLINE_OPTIONS: Array<{ value: DeliverableDiscipline; label: string }> = [
  { value: "civil", label: "Civil" },
  { value: "bim", label: "BIM" },
  { value: "eletromecanico", label: "Eletromecanico" },
];

function deliverableDisciplineLabel(value?: string | null) {
  if (!value) return "N?o informada";
  return DELIVERABLE_DISCIPLINE_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function statusFromStage(stage: ProjectStage): ProjectStatus {
  if (stage === "ofertas" || stage === "pausado") return "paused";
  if (stage === "cancelado") return "done";
  if (stage === "as_built") return "done";
  return "active";
}

function managerLabel(manager: ManagerRow) {
  const name = (manager.full_name ?? "").trim();
  if (name) return name;
  const email = (manager.email ?? "").trim();
  if (email) return email;
  return "Gestor sem nome";
}

function stageLabel(stage: ProjectStage | null | undefined) {
  if (stage === "ofertas") return "Ofertas";
  if (stage === "desenvolvimento") return "Desenvolvimento";
  if (stage === "as_built") return "As Built";
  if (stage === "pausado") return "Pausado";
  if (stage === "cancelado") return "Cancelado";
  return "-";
}

function deliverableStatusLabel(value?: string | null) {
  if (value === "pending") return "Pendente";
  if (value === "in_progress") return "Em andamento";
  if (value === "sent") return "Enviado";
  if (value === "approved") return "Aprovado";
  if (value === "approved_with_comments") return "Aprovado com comentários";
  if (value === "blocked") return "Bloqueado";
  if (value === "cancelled") return "Cancelado";
  return value ?? "Pendente";
}

function formatCurrencyInput(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const value = Number(digits) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function parseCurrencyInput(raw: string): number | null {
  const normalized = raw.replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function allocateEvenlyByCents(total: number | null | undefined, count: number): number[] {
  const safeCount = Math.max(0, count);
  if (!safeCount) return [];
  const totalValue = Number(total ?? 0);
  if (!Number.isFinite(totalValue) || totalValue <= 0) return Array.from({ length: safeCount }, () => 0);
  const totalCents = Math.round(totalValue * 100);
  const baseCents = Math.floor(totalCents / safeCount);
  let remainder = totalCents - baseCents * safeCount;
  return Array.from({ length: safeCount }, () => {
    const cents = baseCents + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return cents / 100;
  });
}

function formatHoursAsHm(value: number | null | undefined) {
  const totalMinutes = Math.max(0, Math.round((Number(value) || 0) * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}min`;
}

function formatDateBR(value: string | null | undefined) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}

function normalizeProjectsInsertError(message: string | null | undefined) {
  const text = String(message ?? "");
  const lowered = text.toLowerCase();
  if (lowered.includes("row-level security") && lowered.includes("projects")) {
    return "Sem permiss?o para criar projeto na tabela projects. O fluxo agora deve usar a API de diretoria. Recarregue a p?gina e tente novamente.";
  }
  if (lowered.includes("projects_project_type_check")) {
    return "A coluna project_type ainda n?o aceita as modalidades novas. Rode a migration supabase/sql/2026-03-02_expand_projects_project_type_check_for_diretoria_modalities.sql no Supabase e tente novamente.";
  }
  if (lowered.includes("project_members_user_id_fkey")) {
    return "Um dos gestores selecionados n?o possui usu?rio v?lido no portal. Escolha apenas usu?rios com acesso ativo e tente novamente.";
  }
  return text || "Falha ao criar projeto.";
}

function normalizeProjectMutationError(message: string | null | undefined) {
  const text = normalizeProjectsInsertError(message);
  const lowered = text.toLowerCase();
  if (lowered.includes("project_members_user_id_fkey")) {
    return "Um dos gestores selecionados n?o possui acesso ativo ao portal. Escolha apenas usu?rios ativos no campo de gestor e tente novamente.";
  }
  if (lowered.includes("gestor respons?vel inv?lido")) {
    return "O gestor respons?vel selecionado n?o possui acesso ativo ao portal. Escolha um usu?rio ativo e tente novamente.";
  }
  if (lowered.includes("gestor(es) adicional(is) sem acesso ativo")) {
    return "H? gestor(es) adicional(is) sem acesso ativo ao portal. Remova esses usu?rios e tente novamente.";
  }
  return text || "Falha ao salvar projeto.";
}

function buildDraftFromProject(project: ExistingProjectRow): ProjectDraft {
  const allowedDiretoriaScopes = new Set<ProjectType>(PROJECT_SCOPE_OPTIONS_DIRETORIA.map((opt) => opt.value));
  return {
    name: project.name ?? "",
    description: project.description ?? "",
    start_date: project.start_date ?? "",
    end_date: project.end_date ?? "",
    budget_total:
      project.budget_total != null
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(project.budget_total)
        : "",
    client_id: project.client_id ?? "",
    project_type:
      project.project_type === "basico" ||
      project.project_type === "executivo" ||
      project.project_type === "eng_proprietario" ||
      project.project_type === "consultoria"
        ? project.project_type
        : "",
    project_line:
      project.project_line === "eolica" || project.project_line === "solar" || project.project_line === "bess"
        ? project.project_line
        : "",
    project_scopes: ((project.project_scopes ?? []) as ProjectType[]).filter((v) => allowedDiretoriaScopes.has(v)),
    project_stage: project.project_stage ?? "ofertas",
    owner_user_id: project.owner_user_id,
    secondary_manager_user_ids: [],
  };
}

function newDeliverableDraft(): DeliverableDraftItem {
  return {
    temp_id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    description: "",
    due_date: "",
    discipline_code: "",
    currency_code: "BRL",
    actual_amount: "",
  };
}

function normalizeDeliverableDrafts(rows: DeliverableDraftItem[]) {
  return rows
    .map((row) => ({
      title: row.title.trim(),
      description: row.description.trim() || null,
      due_date: row.due_date || null,
      discipline_code: row.discipline_code || null,
      currency_code: row.currency_code || "BRL",
      actual_amount: parseCurrencyInput(row.actual_amount),
    }))
    .filter((row) => row.title.length > 0);
}

function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeCsvHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseCsvLine(line: string, delimiter: "," | ";") {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function normalizeCsvDate(value: string) {
  const v = value.trim();
  if (!v) return null;
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}

function normalizeDeliverableTitleKey(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findDuplicateDeliverableTitles(
  incoming: Array<{ title: string }>,
  existingTitles: string[] = []
) {
  const duplicates = new Set<string>();
  const seen = new Set(existingTitles.map((t) => normalizeDeliverableTitleKey(t)).filter(Boolean));
  for (const row of incoming) {
    const key = normalizeDeliverableTitleKey(row.title);
    if (!key) continue;
    if (seen.has(key)) {
      duplicates.add(row.title.trim());
      continue;
    }
    seen.add(key);
  }
  return Array.from(duplicates);
}

function currencySymbol(code?: string | null) {
  if (code === "USD") return "US$";
  if (code === "EUR") return "EUR";
  return "R$";
}

function formatDeliverableMoney(value?: number | null, code?: string | null) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `${currencySymbol(code)} ${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))}`;
}

export default function DiretoriaNovoProjetoPage() {
  const searchParams = useSearchParams();
  const viewMode = searchParams.get("view") === "edit" ? "edit" : "new";
  const isEditView = viewMode === "edit";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");
  const [companyReady, setCompanyReady] = useState(false);

  const [clients, setClients] = useState<ProjectClientRow[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [existingProjects, setExistingProjects] = useState<ExistingProjectRow[]>([]);
  const [secondaryManagerByProjectId, setSecondaryManagerByProjectId] = useState<Record<string, string[]>>({});
  const [draftByProjectId, setDraftByProjectId] = useState<Record<string, ProjectDraft>>({});

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectStart, setNewProjectStart] = useState("");
  const [newProjectEnd, setNewProjectEnd] = useState("");
  const [newProjectBudgetTotal, setNewProjectBudgetTotal] = useState("");
  const [newProjectClientId, setNewProjectClientId] = useState("");
  const [newProjectLine, setNewProjectLine] = useState<ProjectLine | "">("");
  const [newProjectType, setNewProjectType] = useState<ProjectModality | "">("");
  const [newProjectScopes, setNewProjectScopes] = useState<ProjectType[]>([]);
  const [newProjectStage, setNewProjectStage] = useState<ProjectStage>("ofertas");
  const [newProjectManagerId, setNewProjectManagerId] = useState("");
  const [newProjectSecondaryManagerIds, setNewProjectSecondaryManagerIds] = useState<string[]>([]);
  const [newProjectDeliverables, setNewProjectDeliverables] = useState<DeliverableDraftItem[]>([]);
  const [existingDeliverablesByProjectId, setExistingDeliverablesByProjectId] = useState<Record<string, ProjectDeliverableLiteRow[]>>({});
  const [newDeliverablesByProjectId, setNewDeliverablesByProjectId] = useState<Record<string, DeliverableDraftItem[]>>({});
  const [deliverableValueDraftById, setDeliverableValueDraftById] = useState<Record<string, DeliverableValueDraft>>({});
  const [openDeliverableValueEditorByProjectId, setOpenDeliverableValueEditorByProjectId] = useState<Record<string, string | null>>({});
  const [deliverableHoursById, setDeliverableHoursById] = useState<Record<string, number>>({});
  const [deliverableResidualPrompt, setDeliverableResidualPrompt] = useState<DeliverableResidualPrompt | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const managersById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of managers) map[m.id] = managerLabel(m);
    return map;
  }, [managers]);

  const loadCompaniesAndInitial = useCallback(async () => {
    setLoading(true);
    setMsg("");
    setCompanyReady(false);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const companiesRes = await fetch("/api/admin/company", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      let nextCompanies: CompanyRow[] = [];
      if (companiesRes.ok) {
        const companiesJson = (await companiesRes.json()) as { companies?: CompanyRow[]; error?: string };
        nextCompanies = companiesJson.companies ?? [];
      } else {
        // Fallback para role diretoria: usa escopo retornado pela API de negocio.
        const formRes = await fetch("/api/diretoria/project-form-options", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const formJson = (await formRes.json()) as { company_id?: string | null; error?: string };
        if (!formRes.ok) throw new Error(formJson.error || "Erro ao carregar escopo da diretoria.");
        if (formJson.company_id) nextCompanies = [{ id: formJson.company_id, name: "Empresa vinculada" }];
      }

      setCompanies(nextCompanies);
      if (nextCompanies.length > 0) {
        setSelectedCompanyId((prev) => prev || nextCompanies[0].id);
      } else {
        setSelectedCompanyId("");
        setMsg("Nenhuma empresa encontrada para seu perfil.");
      }
    } catch (e: unknown) {
      setCompanies([]);
      setSelectedCompanyId("");
      setMsg(e instanceof Error ? e.message : "Erro ao carregar empresas.");
    } finally {
      setCompanyReady(true);
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("N?o autenticado.");
      setMeId(authData.user.id);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const companyQuery = selectedCompanyId ? `?company_id=${encodeURIComponent(selectedCompanyId)}` : "";

      const isMissingColumnError = (text: string) => {
        const s = (text || "").toLowerCase();
        return s.includes("does not exist") || s.includes("schema cache") || s.includes("column");
      };

      let formOptions: { clients?: ProjectClientRow[]; managers?: ManagerRow[] } = {};
      let formOptionsWarn = "";
      try {
        const formOptionsRes = await fetch(`/api/diretoria/project-form-options${companyQuery}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const formOptionsJson = (await formOptionsRes.json()) as {
          clients?: ProjectClientRow[];
          managers?: ManagerRow[];
          error?: string;
        };
        if (formOptionsRes.ok) {
          formOptions = formOptionsJson;
        } else {
          formOptionsWarn = formOptionsJson.error || "Falha ao carregar opcoes pela API.";
        }
      } catch (err: unknown) {
        formOptionsWarn = err instanceof Error ? err.message : "Falha ao carregar opcoes pela API.";
      }

      let projectsRes: {
        data: ExistingProjectRow[] | null;
        error: { message: string } | null;
      } = { data: null, error: null };
      {
        const base = supabase
          .from("projects")
          .select("id,name,description,start_date,end_date,budget_total,client_id,project_type,project_line,project_scopes,project_stage,status,owner_user_id,created_at")
          .order("created_at", { ascending: false });

        const scoped = selectedCompanyId
          ? await base.or(`company_id.eq.${selectedCompanyId},company_id.is.null`)
          : await base;
        if (scoped.error && isMissingColumnError(scoped.error.message)) {
          const fallback = await supabase
            .from("projects")
            .select("id,name,description,start_date,end_date,budget_total,client_id,project_type,project_line,project_scopes,project_stage,status,owner_user_id,created_at")
            .order("created_at", { ascending: false });
          projectsRes = {
            data: (fallback.data ?? null) as ExistingProjectRow[] | null,
            error: fallback.error ? { message: fallback.error.message } : null,
          };
        } else {
          projectsRes = {
            data: (scoped.data ?? null) as ExistingProjectRow[] | null,
            error: scoped.error ? { message: scoped.error.message } : null,
          };
        }
      }

      if (projectsRes.error) throw new Error(projectsRes.error.message);

      let nextClients = formOptions.clients ?? [];
      const nextProjects = (projectsRes.data ?? []) as ExistingProjectRow[];
      const projectIds = nextProjects.map((p) => p.id);
      const nextExistingDeliverablesByProjectId: Record<string, ProjectDeliverableLiteRow[]> = {};

      if (projectIds.length > 0) {
        const deliverablesRes = await supabase
          .from("project_deliverables")
          .select("id,project_id,title,description,due_date,status,discipline_code,currency_code,budget_amount,actual_amount,financial_status")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false });

        let deliverablesData = (deliverablesRes.data ?? []) as ProjectDeliverableLiteRow[];
        let deliverablesError = deliverablesRes.error;

        if (deliverablesError && isMissingColumnError(deliverablesError.message)) {
          const fallbackWithoutFinancial = await supabase
            .from("project_deliverables")
            .select("id,project_id,title,description,due_date,status,discipline_code,currency_code,budget_amount,actual_amount")
            .in("project_id", projectIds)
            .order("created_at", { ascending: false });

          if (fallbackWithoutFinancial.error && isMissingColumnError(fallbackWithoutFinancial.error.message)) {
            const fallbackWithoutDisciplineAndFinancial = await supabase
              .from("project_deliverables")
              .select("id,project_id,title,description,due_date,status,currency_code,budget_amount,actual_amount")
              .in("project_id", projectIds)
              .order("created_at", { ascending: false });

            deliverablesData = ((fallbackWithoutDisciplineAndFinancial.data ?? []) as Array<
              Omit<ProjectDeliverableLiteRow, "discipline_code" | "financial_status">
            >).map((row) => ({
              ...row,
              discipline_code: null,
              financial_status: "aberto",
            })) as ProjectDeliverableLiteRow[];
            deliverablesError = fallbackWithoutDisciplineAndFinancial.error;
          } else {
            deliverablesData = ((fallbackWithoutFinancial.data ?? []) as Array<
              Omit<ProjectDeliverableLiteRow, "financial_status">
            >).map((row) => ({
              ...row,
              financial_status: "aberto",
            })) as ProjectDeliverableLiteRow[];
            deliverablesError = fallbackWithoutFinancial.error;
          }
        }

        const assigneesRes = await supabase
          .from("project_deliverable_assignees")
          .select("deliverable_id,contribution_unit,contribution_value")
          .in("project_id", projectIds);

        if (!deliverablesError) {
          for (const row of deliverablesData) {
            if (!nextExistingDeliverablesByProjectId[row.project_id]) nextExistingDeliverablesByProjectId[row.project_id] = [];
            nextExistingDeliverablesByProjectId[row.project_id].push(row);
          }
        }
        const nextDeliverableHoursById: Record<string, number> = {};
        if (!assigneesRes.error) {
          for (const a of (assigneesRes.data ?? []) as DeliverableAssigneeRow[]) {
            if (!a.deliverable_id) continue;
            if (a.contribution_unit && a.contribution_unit !== "hours") continue;
            nextDeliverableHoursById[a.deliverable_id] =
              (nextDeliverableHoursById[a.deliverable_id] ?? 0) + Number(a.contribution_value ?? 0);
          }
        }
        setDeliverableHoursById(nextDeliverableHoursById);
      }

      const managerMap = new Map<string, ManagerRow>();
      for (const m of formOptions.managers ?? []) {
        if (!m.id) continue;
        managerMap.set(m.id, { id: m.id, full_name: m.full_name ?? null, email: m.email ?? null });
      }

      // Fallback defensivo: quando a API de opcoes retorna vazio, carrega direto das tabelas.
      if (nextClients.length === 0) {
        const clientsFallback = await supabase
          .from("project_clients")
          .select("id,name,active")
          .eq("active", true)
          .order("name", { ascending: true });
        if (!clientsFallback.error) {
          nextClients = ((clientsFallback.data ?? []) as Array<{ id: string; name: string; active?: boolean | null }>).map((c) => ({
            id: c.id,
            name: c.name,
          }));
        }
      }

      if (managerMap.size === 0) {
        const [colabFallback, profilesFallback] = await Promise.all([
          supabase.from("colaboradores").select("user_id,nome,email,cargo").not("user_id", "is", null).order("nome", { ascending: true }),
          supabase.from("profiles").select("id,full_name,active").eq("active", true).order("full_name", { ascending: true }),
        ]);

        if (!profilesFallback.error) {
          for (const p of (profilesFallback.data ?? []) as Array<{ id: string; full_name: string | null }>) {
            if (!p.id) continue;
            managerMap.set(p.id, { id: p.id, full_name: p.full_name ?? null, email: null });
          }
        }

        if (!colabFallback.error) {
          for (const c of (colabFallback.data ?? []) as Array<{ user_id: string | null; nome: string | null; email: string | null }>) {
            const uid = (c.user_id ?? "").trim();
            if (!uid) continue;
            const prev = managerMap.get(uid);
            managerMap.set(uid, {
              id: uid,
              full_name: (c.nome ?? "").trim() || prev?.full_name || null,
              email: (c.email ?? "").trim() || prev?.email || null,
            });
          }
        }
      }

      for (const p of nextProjects) {
        const uid = (p.owner_user_id ?? "").trim();
        if (!uid || managerMap.has(uid)) continue;
        managerMap.set(uid, { id: uid, full_name: null, email: null });
      }

      const secondaryByProjectId: Record<string, string[]> = {};
      if (nextProjects.length > 0) {
        const membersRes = await supabase
          .from("project_members")
          .select("project_id,user_id,member_role")
          .in("project_id", projectIds)
          .eq("member_role", "gestor");
        if (!membersRes.error) {
          const ownerByProjectId = new Map(nextProjects.map((p) => [p.id, p.owner_user_id]));
          for (const row of (membersRes.data ??
            []) as Array<{ project_id: string; user_id: string; member_role: string }>) {
            const ownerId = ownerByProjectId.get(row.project_id);
            if (!ownerId) continue;
            if (row.user_id === ownerId) continue;
            if (!secondaryByProjectId[row.project_id]) secondaryByProjectId[row.project_id] = [];
            if (!secondaryByProjectId[row.project_id].includes(row.user_id)) {
              secondaryByProjectId[row.project_id].push(row.user_id);
            }
          }
        }
      }

      const nextManagers = Array.from(managerMap.values()).sort((a, b) =>
        managerLabel(a).localeCompare(managerLabel(b), "pt-BR", { sensitivity: "base" })
      );

      setClients(nextClients);
      setManagers(nextManagers);
      setExistingProjects(nextProjects);
      setExistingDeliverablesByProjectId(nextExistingDeliverablesByProjectId);
      setSecondaryManagerByProjectId(secondaryByProjectId);

      setDraftByProjectId(() => {
        const next: Record<string, ProjectDraft> = {};
        for (const project of nextProjects) {
          next[project.id] = {
            ...buildDraftFromProject(project),
            secondary_manager_user_ids: secondaryByProjectId[project.id] ?? [],
          };
        }
        return next;
      });
      setDeliverableValueDraftById(() => {
        const next: Record<string, DeliverableValueDraft> = {};
        for (const rows of Object.values(nextExistingDeliverablesByProjectId)) {
          for (const d of rows) {
            next[d.id] = {
              currency_code: d.currency_code === "USD" || d.currency_code === "EUR" ? d.currency_code : "BRL",
              actual_amount:
                d.actual_amount != null
                  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.actual_amount))
                  : "",
            };
          }
        }
        return next;
      });
      setNewDeliverablesByProjectId((prev) => {
        const next: Record<string, DeliverableDraftItem[]> = {};
        for (const project of nextProjects) next[project.id] = prev[project.id] ?? [];
        return next;
      });

      if (!newProjectManagerId && nextManagers.length > 0) {
        setNewProjectManagerId(nextManagers[0].id);
      }
      setNewProjectSecondaryManagerIds((prev) => prev.filter((id) => id !== newProjectManagerId));

      if (formOptionsWarn) {
        setMsg(`Aviso: ${formOptionsWarn}`);
      }
    } catch (e: unknown) {
      setClients([]);
      setManagers([]);
      setExistingProjects([]);
      setSecondaryManagerByProjectId({});
      setDraftByProjectId({});
      setExistingDeliverablesByProjectId({});
      setNewDeliverablesByProjectId({});
      setDeliverableValueDraftById({});
      setOpenDeliverableValueEditorByProjectId({});
      setDeliverableHoursById({});
      setMsg(e instanceof Error ? e.message : "Erro ao carregar cadastro de projeto.");
    } finally {
      setLoading(false);
    }
  }, [newProjectManagerId, selectedCompanyId]);

  useEffect(() => {
    void loadCompaniesAndInitial();
  }, [loadCompaniesAndInitial]);

  useEffect(() => {
    if (!companyReady) return;
    void load();
  }, [companyReady, load]);

  function toggleProjectScope(scope: ProjectType) {
    setNewProjectScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  function toggleNewProjectAdditionalManager(managerId: string) {
    if (!managerId || managerId === newProjectManagerId) return;
    setNewProjectSecondaryManagerIds((prev) =>
      prev.includes(managerId) ? prev.filter((id) => id !== managerId) : [...prev, managerId]
    );
  }

  function toggleExistingScope(projectId: string, scope: ProjectType) {
    setDraftByProjectId((prev) => {
      const draft = prev[projectId];
      if (!draft) return prev;
      const nextScopes = draft.project_scopes.includes(scope)
        ? draft.project_scopes.filter((s) => s !== scope)
        : [...draft.project_scopes, scope];
      return { ...prev, [projectId]: { ...draft, project_scopes: nextScopes } };
    });
  }

  function toggleExistingAdditionalManager(projectId: string, managerId: string) {
    setDraftByProjectId((prev) => {
      const draft = prev[projectId];
      if (!draft || !managerId || managerId === draft.owner_user_id) return prev;
      const nextIds = draft.secondary_manager_user_ids.includes(managerId)
        ? draft.secondary_manager_user_ids.filter((id) => id !== managerId)
        : [...draft.secondary_manager_user_ids, managerId];
      return { ...prev, [projectId]: { ...draft, secondary_manager_user_ids: nextIds } };
    });
  }

  function openDeliverableValueEditor(project: ExistingProjectRow, deliverable: ProjectDeliverableLiteRow) {
    if ((deliverable.financial_status ?? "aberto") !== "aberto") {
      setMsg("Entregável vinculado a boletim (pendente/baixado) n?o pode ser alterado. O valor será preservado.");
      return;
    }
    const totalDeliverables = Math.max(1, (existingDeliverablesByProjectId[project.id] ?? []).length);
    const budget = Number(project.budget_total) || 0;
    const fallbackPerDeliverable = budget > 0 ? budget / totalDeliverables : null;

    setDeliverableValueDraftById((prev) => {
      const current = prev[deliverable.id] ?? {
        title: (deliverable.title ?? "").trim(),
        discipline_code:
          deliverable.discipline_code === "civil" ||
          deliverable.discipline_code === "bim" ||
          deliverable.discipline_code === "eletromecanico"
            ? deliverable.discipline_code
            : undefined,
        currency_code: (deliverable.currency_code === "USD" || deliverable.currency_code === "EUR" ? deliverable.currency_code : "BRL"),
        actual_amount: "",
        due_date: deliverable.due_date ?? "",
      };
      const nextBase: DeliverableValueDraft = {
        ...current,
        due_date: current.due_date ?? deliverable.due_date ?? "",
      };
      const hasActualDraft = (current.actual_amount ?? "").trim().length > 0;
      if (hasActualDraft || deliverable.actual_amount != null || fallbackPerDeliverable == null) {
        return { ...prev, [deliverable.id]: nextBase };
      }
      return {
        ...prev,
        [deliverable.id]: {
          ...nextBase,
          actual_amount: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(fallbackPerDeliverable),
        },
      };
    });

    setOpenDeliverableValueEditorByProjectId((prev) => ({
      ...prev,
      [project.id]: prev[project.id] === deliverable.id ? null : deliverable.id,
    }));
    setDeliverableResidualPrompt((prev) =>
      prev && prev.project_id === project.id && prev.deliverable_id === deliverable.id ? null : prev
    );
  }

  function effectiveDeliverableActual(project: ExistingProjectRow, row: ProjectDeliverableLiteRow, rows?: ProjectDeliverableLiteRow[]) {
    if (row.actual_amount != null && Number.isFinite(Number(row.actual_amount))) return Number(row.actual_amount);
    const list = rows ?? existingDeliverablesByProjectId[project.id] ?? [];
    const totalDeliverables = Math.max(1, list.length);
    const budget = Number(project.budget_total) || 0;
    if (budget <= 0) return 0;
    return budget / totalDeliverables;
  }

  function cancelDeliverableInlineEditor(projectId: string, deliverableId: string) {
    setDeliverableValueDraftById((prev) => {
      const next = { ...prev };
      delete next[deliverableId];
      return next;
    });
    setOpenDeliverableValueEditorByProjectId((prev) => ({ ...prev, [projectId]: null }));
    setDeliverableResidualPrompt((prev) =>
      prev && prev.project_id === projectId && prev.deliverable_id === deliverableId ? null : prev
    );
  }

  async function persistDeliverableInlineValue(
    project: ExistingProjectRow,
    deliverable: ProjectDeliverableLiteRow,
    selectedResidualTargetIds: string[] | null
  ) {
    const projectId = project.id;
    const values = deliverableValueDraftById[deliverable.id];
    if (!values) return;

    setSaving(true);
    setMsg("");
    try {
      if ((deliverable.financial_status ?? "aberto") !== "aberto") {
        throw new Error("Entregável vinculado a boletim (pendente/baixado) n?o pode ser alterado. O valor será preservado.");
      }
      const nextTitle = (values.title ?? "").trim() || (deliverable.title ?? "").trim() || "Entreg?vel sem titulo";
      const nextCurrency = values.currency_code || "BRL";
      const nextActual = parseCurrencyInput(values.actual_amount);
      const nextDueDate = (values.due_date ?? "").trim() || null;

      const rows = existingDeliverablesByProjectId[projectId] ?? [];
      const selectedTargets = (selectedResidualTargetIds ?? []).filter((id) => {
        if (id === deliverable.id) return false;
        const row = rows.find((r) => r.id === id);
        return (row?.financial_status ?? "aberto") === "aberto";
      });
      const nextDiscipline =
        values.discipline_code === "civil" ||
        values.discipline_code === "bim" ||
        values.discipline_code === "eletromecanico"
          ? values.discipline_code
          : null;
      const batchUpdates: Array<{
        id: string;
        title?: string;
        discipline_code?: DeliverableDiscipline | null;
        currency_code?: "BRL" | "USD" | "EUR";
        actual_amount?: number | null;
        due_date?: string | null;
      }> = [{ id: deliverable.id, title: nextTitle, discipline_code: nextDiscipline, currency_code: nextCurrency, actual_amount: nextActual, due_date: nextDueDate }];

      if (selectedTargets.length > 0 && (Number(project.budget_total) || 0) > 0) {
        const effectiveCurrentById: Record<string, number> = {};
        for (const row of rows) {
          effectiveCurrentById[row.id] = effectiveDeliverableActual(project, row, rows);
        }
        const targetEffective = nextActual ?? effectiveCurrentById[deliverable.id] ?? 0;
        const residual =
          (Number(project.budget_total) || 0) -
          rows.reduce((sum, row) => sum + (row.id === deliverable.id ? targetEffective : (effectiveCurrentById[row.id] ?? 0)), 0);
        const delta = residual / selectedTargets.length;
        for (const targetId of selectedTargets) {
          const row = rows.find((r) => r.id === targetId);
          if (!row) continue;
          const nextValue = (effectiveCurrentById[targetId] ?? 0) + delta;
          if (nextValue < 0) {
            throw new Error("Rateio residual gerou valor negativo em um entreg?vel. Ajuste manualmente a distribuicao.");
          }
          batchUpdates.push({ id: targetId, actual_amount: nextValue });
        }
      }

      for (const upd of batchUpdates) {
        const payload: Record<string, unknown> = {};
        if ("title" in upd && upd.title !== undefined) payload.title = upd.title;
        if ("currency_code" in upd && upd.currency_code !== undefined) payload.currency_code = upd.currency_code;
        if ("discipline_code" in upd && upd.discipline_code !== undefined) payload.discipline_code = upd.discipline_code;
        if ("actual_amount" in upd && upd.actual_amount !== undefined) payload.actual_amount = upd.actual_amount;
        if ("due_date" in upd && upd.due_date !== undefined) payload.due_date = upd.due_date;
        const updDeliverable = await supabase
          .from("project_deliverables")
          .update(payload)
          .eq("id", upd.id)
          .eq("project_id", projectId);
        if (updDeliverable.error) throw updDeliverable.error;
      }

      setExistingDeliverablesByProjectId((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((row) =>
          row.id === deliverable.id
            ? { ...row, title: nextTitle, discipline_code: nextDiscipline, currency_code: nextCurrency, actual_amount: nextActual, due_date: nextDueDate }
            : (() => {
                const rebalanceHit = batchUpdates.find((u) => u.id === row.id && u.id !== deliverable.id);
                return rebalanceHit && rebalanceHit.actual_amount !== undefined
                  ? { ...row, actual_amount: rebalanceHit.actual_amount as number | null }
                  : row;
              })()
        ),
      }));
      setOpenDeliverableValueEditorByProjectId((prev) => ({ ...prev, [projectId]: null }));
      setDeliverableResidualPrompt(null);
      setMsg(
        selectedTargets.length > 0
          ? `Entreg?vel atualizado (${deliverableDisciplineLabel(nextDiscipline)}) e residual rateado com sucesso.`
          : `Entreg?vel atualizado (${deliverableDisciplineLabel(nextDiscipline)}) com sucesso.`
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar valor/prazo/disciplina do entreg?vel.");
    } finally {
      setSaving(false);
    }
  }

  function requestSaveDeliverableInlineValue(project: ExistingProjectRow, deliverable: ProjectDeliverableLiteRow) {
    const values = deliverableValueDraftById[deliverable.id];
    if (!values) return;
    const rows = existingDeliverablesByProjectId[project.id] ?? [];
    const budget = Number(project.budget_total) || 0;
    if (budget <= 0 || rows.length <= 1) {
      void persistDeliverableInlineValue(project, deliverable, null);
      return;
    }

    const nextActual = parseCurrencyInput(values.actual_amount);
    const effectiveCurrentById: Record<string, number> = {};
    for (const row of rows) effectiveCurrentById[row.id] = effectiveDeliverableActual(project, row, rows);
    const targetEffective = nextActual ?? effectiveCurrentById[deliverable.id] ?? 0;
    const residual =
      budget -
      rows.reduce((sum, row) => sum + (row.id === deliverable.id ? targetEffective : (effectiveCurrentById[row.id] ?? 0)), 0);

    if (Math.abs(residual) < 0.01) {
      void persistDeliverableInlineValue(project, deliverable, null);
      return;
    }

    const candidateOpenRows = rows.filter((r) => r.id !== deliverable.id && (r.financial_status ?? "aberto") === "aberto");
    if (candidateOpenRows.length === 0) {
      setMsg("N?o há entregáveis com status financeiro aberto para absorver o residual. Ajuste os valores manualmente.");
      return;
    }

    setDeliverableResidualPrompt({
      project_id: project.id,
      deliverable_id: deliverable.id,
      residual_amount: residual,
      candidate_ids: candidateOpenRows.map((r) => r.id),
      phase: "ask",
      selected_ids: [],
    });
  }

  async function ensureProjectManagerMembership(projectId: string, managerId: string) {
    if (!managers.some((m) => m.id === managerId)) {
      throw new Error("O gestor selecionado n?o possui acesso ativo ao portal.");
    }
    const result = await supabase.from("project_members").upsert(
      {
        project_id: projectId,
        user_id: managerId,
        member_role: "gestor",
        added_by: meId || null,
      },
      { onConflict: "project_id,user_id" }
    );
    if (result.error) {
      throw new Error(normalizeProjectMutationError(result.error.message));
    }
  }

  async function syncProjectManagers(projectId: string, managerIds: string[]) {
    const selected = Array.from(new Set(managerIds.filter(Boolean)));
    if (selected.length === 0) return;

    for (const managerId of selected) {
      await ensureProjectManagerMembership(projectId, managerId);
    }

    const currentRes = await supabase
      .from("project_members")
      .select("id,user_id")
      .eq("project_id", projectId)
      .eq("member_role", "gestor");
    if (currentRes.error) return;

    const toDeleteIds = ((currentRes.data ?? []) as Array<{ id: string; user_id: string }>)
      .filter((row) => !selected.includes(row.user_id))
      .map((row) => row.id);
    if (toDeleteIds.length > 0) {
      await supabase.from("project_members").delete().in("id", toDeleteIds);
    }
  }

  async function insertProjectDeliverables(projectId: string, rows: DeliverableDraftItem[], projectBudgetTotal?: number | null) {
    const normalized = normalizeDeliverableDrafts(rows);
    if (normalized.length === 0) return 0;
    const fallbackAllocations = allocateEvenlyByCents(projectBudgetTotal ?? null, normalized.length);

    const { error } = await supabase.from("project_deliverables").insert(
      normalized.map((row, index) => ({
        project_id: projectId,
        title: row.title,
        description: row.description,
        due_date: row.due_date,
        status: "pending",
        discipline_code: row.discipline_code || null,
        currency_code: row.currency_code,
        budget_amount: null,
        actual_amount: row.actual_amount ?? (fallbackAllocations[index] > 0 ? fallbackAllocations[index] : null),
      }))
    );
    if (error) throw error;
    return normalized.length;
  }

  async function recalculateProjectDeliverablesRateio(project: ExistingProjectRow) {
    const projectId = project.id;
    const rows = existingDeliverablesByProjectId[projectId] ?? [];
    const budget = Number(project.budget_total) || 0;
    if (rows.length === 0) {
      setMsg("Este projeto n?o possui entregáveis cadastrados para recalcular.");
      return;
    }
    if (budget <= 0) {
      setMsg("In?orme um or?amento v?lido no projeto para recalcular o rateio.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const lockedRows = rows.filter((r) => (r.financial_status ?? "aberto") !== "aberto");
      const editableRows = rows.filter((r) => (r.financial_status ?? "aberto") === "aberto");
      const lockedTotal = lockedRows.reduce((sum, r) => sum + (Number(r.actual_amount) || 0), 0);
      const remainingBudget = budget - lockedTotal;

      if (editableRows.length === 0) {
        setMsg("N?o há entregáveis em aberto para recalcular. Itens pendentes/baixados em boletim foram preservados.");
        return;
      }
      if (remainingBudget < -0.009) {
        throw new Error("O total dos documentos já baixados ultrapassa o orçamen?o do projeto. Ajuste os valores manualmente.");
      }

      const allocations = allocateEvenlyByCents(Math.max(0, remainingBudget), editableRows.length);
      for (let i = 0; i < editableRows.length; i += 1) {
        const row = editableRows[i];
        const nextValue = allocations[i] ?? 0;
        const { error } = await supabase
          .from("project_deliverables")
          .update({ actual_amount: nextValue })
          .eq("id", row.id)
          .eq("project_id", projectId);
        if (error) throw error;
      }

      setExistingDeliverablesByProjectId((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((row) => {
          const idx = editableRows.findIndex((r) => r.id === row.id);
          if (idx < 0) return row;
          return { ...row, actual_amount: allocations[idx] ?? row.actual_amount };
        }),
      }));
      setMsg(
        lockedRows.length > 0
          ? "Rateio recalculado somente nos documentos em aberto. Entregaveis pendentes/baixados em boletim foram preservados."
          : "Rateio recalculado com sucesso. O total dos entregáveis agora fecha exatamente com o orçamen?o do projeto."
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao recalcular rateio dos entregáveis.");
    } finally {
      setSaving(false);
    }
  }

  async function importDeliverablesFromCsv(projectId: string, file: File) {
    setSaving(true);
    setMsg("");
    try {
      const raw = await file.text();
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) throw new Error("CSV vazio ou sem linhas de dados.");

      const delimiter: "," | ";" =
        (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
      const headers = parseCsvLine(lines[0], delimiter).map(normalizeCsvHeader);

      const titleIdx = headers.findIndex((h) =>
        ["titulo_entregavel", "titulo", "entreg?vel", "title"].includes(h)
      );
      const dueIdx = headers.findIndex((h) =>
        ["previsao_entrega", "prazo", "due_date", "data_previsao", "data_entrega"].includes(h)
      );
      const descIdx = headers.findIndex((h) => ["descri??o", "description", "detalhes"].includes(h));
      const disciplineIdx = headers.findIndex((h) => ["disciplina", "discipline", "discipline_code"].includes(h));
      const actualIdx = headers.findIndex((h) => ["valor_real", "actual_amount", "valor_executado"].includes(h));
      const currencyIdx = headers.findIndex((h) => ["moeda", "currency", "currency_code"].includes(h));

      if (titleIdx < 0) throw new Error("CSV inv?lido: cabe?alho deve conter a coluna de titulo do entreg?vel.");

      const rows: DeliverableDraftItem[] = lines
        .slice(1)
        .map((line) => parseCsvLine(line, delimiter))
        .map((cols) => {
          const rawDiscipline = (disciplineIdx >= 0 ? (cols[disciplineIdx] ?? "") : "").trim().toLowerCase();
          const discipline_code: DeliverableDiscipline | "" =
            rawDiscipline === "civil" || rawDiscipline === "bim" || rawDiscipline === "eletromecanico"
              ? (rawDiscipline as DeliverableDiscipline)
              : "";
          return {
            temp_id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: (cols[titleIdx] ?? "").trim(),
            due_date: dueIdx >= 0 ? (normalizeCsvDate(cols[dueIdx] ?? "") ?? "") : "",
            description: descIdx >= 0 ? (cols[descIdx] ?? "").trim() : "",
            discipline_code,
            currency_code: (((currencyIdx >= 0 ? (cols[currencyIdx] ?? "") : "").trim().toUpperCase() || "BRL") as "BRL" | "USD" | "EUR"),
            actual_amount: actualIdx >= 0 ? (cols[actualIdx] ?? "").trim() : "",
          };
        })
        .filter((r) => r.title.length > 0);

      if (rows.length === 0) throw new Error("Nenhuma linha v?lida encontrada no CSV.");
      const duplicates = findDuplicateDeliverableTitles(
        rows,
        (existingDeliverablesByProjectId[projectId] ?? []).map((d) => d.title ?? "")
      );
      if (duplicates.length > 0) {
        throw new Error(
          `CSV contem entreg?vel(is) duplicado(s) no projeto: ${duplicates.slice(0, 5).join(", ")}${duplicates.length > 5 ? "..." : ""}.`
        );
      }

      const inserted = await insertProjectDeliverables(projectId, rows, parseCurrencyInput(draftByProjectId[projectId]?.budget_total ?? "") ?? null);
      setMsg(`${inserted} entreg?vel(eis) importado(s) com sucesso. Revise a disciplina de cada documento.`);
      setNewDeliverablesByProjectId((prev) => ({ ...prev, [projectId]: [] }));
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao importar CSV de entregáveis.");
    } finally {
      setSaving(false);
    }
  }

  async function importNewProjectDeliverablesFromCsv(file: File) {
    setSaving(true);
    setMsg("");
    try {
      const raw = await file.text();
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) throw new Error("CSV vazio ou sem linhas de dados.");

      const delimiter: "," | ";" =
        (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
      const headers = parseCsvLine(lines[0], delimiter).map(normalizeCsvHeader);

      const titleIdx = headers.findIndex((h) =>
        ["titulo_entregavel", "titulo", "entreg?vel", "title"].includes(h)
      );
      const dueIdx = headers.findIndex((h) =>
        ["previsao_entrega", "prazo", "due_date", "data_previsao", "data_entrega"].includes(h)
      );
      const descIdx = headers.findIndex((h) => ["descri??o", "description", "detalhes"].includes(h));
      const disciplineIdx = headers.findIndex((h) => ["disciplina", "discipline", "discipline_code"].includes(h));
      const actualIdx = headers.findIndex((h) => ["valor_real", "actual_amount", "valor_executado"].includes(h));
      const currencyIdx = headers.findIndex((h) => ["moeda", "currency", "currency_code"].includes(h));
      if (titleIdx < 0) throw new Error("CSV inv?lido: cabe?alho deve conter a coluna de titulo do entreg?vel.");

      const rows: DeliverableDraftItem[] = lines
        .slice(1)
        .map((line) => parseCsvLine(line, delimiter))
        .map((cols) => {
          const rawDiscipline = (disciplineIdx >= 0 ? (cols[disciplineIdx] ?? "") : "").trim().toLowerCase();
          const discipline_code: DeliverableDiscipline | "" =
            rawDiscipline === "civil" || rawDiscipline === "bim" || rawDiscipline === "eletromecanico"
              ? (rawDiscipline as DeliverableDiscipline)
              : "";
          return {
            temp_id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: (cols[titleIdx] ?? "").trim(),
            due_date: dueIdx >= 0 ? (normalizeCsvDate(cols[dueIdx] ?? "") ?? "") : "",
            description: descIdx >= 0 ? (cols[descIdx] ?? "").trim() : "",
            discipline_code,
            currency_code: (((currencyIdx >= 0 ? (cols[currencyIdx] ?? "") : "").trim().toUpperCase() || "BRL") as "BRL" | "USD" | "EUR"),
            actual_amount: actualIdx >= 0 ? (cols[actualIdx] ?? "").trim() : "",
          };
        })
        .filter((r) => r.title.length > 0);

      if (rows.length === 0) throw new Error("Nenhuma linha v?lida encontrada no CSV.");
      const duplicates = findDuplicateDeliverableTitles(
        rows,
        newProjectDeliverables.map((d) => d.title)
      );
      if (duplicates.length > 0) {
        throw new Error(
          `CSV contem entreg?vel(is) duplicado(s) no cadastro atual: ${duplicates.slice(0, 5).join(", ")}${duplicates.length > 5 ? "..." : ""}.`
        );
      }

      setNewProjectDeliverables((prev) => [...prev, ...rows]);
      setMsg(`${rows.length} entreg?vel(eis) carregado(s) no cadastro do projeto. Verifique a disciplina e clique em Criar projeto para salvar.`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao importar CSV de entregáveis.");
    } finally {
      setSaving(false);
    }
  }

  async function createProject() {
    if (!newProjectName.trim()) return setMsg("In?orme o nome do projeto.");
    if (!newProjectClientId) return setMsg("Selecione o cliente do projeto.");
    if (!newProjectLine) return setMsg("Selecione a linha do projeto.");
    if (!newProjectType) return setMsg("Selecione a modalidade do projeto.");
    if (!newProjectManagerId) return setMsg("Selecione o gestor responsável.");
    if (newProjectSecondaryManagerIds.includes(newProjectManagerId)) {
      return setMsg("Gestor adicional deve ser diferente do gestor principal.");
    }
    if (!meId) return setMsg("Usuário n?o identificado.");
    setSaving(true);
    setMsg("");
    try {
      const budgetTotal = parseCurrencyInput(newProjectBudgetTotal);
      const normalizedDeliverables = normalizeDeliverableDrafts(newProjectDeliverables);

      const payload = {
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || null,
        start_date: newProjectStart || null,
        end_date: newProjectEnd || null,
        budget_total: budgetTotal,
        client_id: newProjectClientId,
        project_line: newProjectLine,
        project_type: newProjectType,
        project_scopes: newProjectScopes,
        project_stage: newProjectStage,
        status: statusFromStage(newProjectStage),
        owner_user_id: newProjectManagerId,
        company_id: selectedCompanyId || null,
        secondary_manager_user_ids: newProjectSecondaryManagerIds,
        deliverables: normalizedDeliverables,
      };

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const createRes = await fetch("/api/diretoria/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const createJson = (await createRes.json()) as { id?: string; createdDeliverables?: number; error?: string };
      if (!createRes.ok || !createJson.id) {
        throw new Error(normalizeProjectsInsertError(createJson.error));
      }
      const createdDeliverables = Number(createJson.createdDeliverables) || 0;

      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectStart("");
      setNewProjectEnd("");
      setNewProjectBudgetTotal("");
      setNewProjectClientId("");
      setNewProjectLine("");
      setNewProjectType("");
      setNewProjectScopes([]);
      setNewProjectStage("ofertas");
      setNewProjectSecondaryManagerIds([]);
      setNewProjectDeliverables([]);
      setMsg(
        createdDeliverables > 0
          ? `Projeto criado com sucesso, gestor direcionado e ${createdDeliverables} entreg?vel(is) cadastrado(s) com disciplina.`
          : "Projeto criado com sucesso e gestor direcionado."
      );
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? normalizeProjectMutationError(e.message) : "Erro ao criar projeto.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExistingProject(project: ExistingProjectRow) {
    const ok = window.confirm(
      `Deseja realmente excluir o projeto "${project.name}"? Se ele tiver dados vinculados, a exclusao sera bloqueada.`
    );
    if (!ok) return;

    setSaving(true);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const deleteRes = await fetch("/api/diretoria/projects", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ project_id: project.id }),
      });
      const deleteJson = (await deleteRes.json()) as { error?: string };
      if (!deleteRes.ok) {
        throw new Error(deleteJson.error || "Falha ao excluir projeto.");
      }
      if (editingProjectId === project.id) setEditingProjectId(null);
      setMsg("Projeto excluido com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir projeto.");
    } finally {
      setSaving(false);
    }
  }

  async function saveExistingProject(projectId: string) {
    const draft = draftByProjectId[projectId];
    if (!draft) return;
    if (!draft.name.trim()) return setMsg("Nome do projeto e obrigatorio.");
    if (!draft.owner_user_id) return setMsg("Selecione o gestor responsável.");
    if (draft.secondary_manager_user_ids.includes(draft.owner_user_id)) {
      return setMsg("Gestor adicional deve ser diferente do gestor principal.");
    }

    setSaving(true);
    setMsg("");
    try {
      const budgetTotal = parseCurrencyInput(draft.budget_total);
      const nextClientId = draft.client_id.trim() ? draft.client_id.trim() : null;
      const nextProjectLine = draft.project_line ? draft.project_line : null;
      const nextProjectType = draft.project_type ? draft.project_type : null;
      const nextScopes = (() => {
        const allowed = new Set<ProjectType>(PROJECT_SCOPE_OPTIONS_DIRETORIA.map((opt) => opt.value));
        const sanitized = draft.project_scopes.filter((s) => allowed.has(s));
        return sanitized.length > 0 ? sanitized : null;
      })();
      const updatePayload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        budget_total: budgetTotal,
        client_id: nextClientId,
        project_line: nextProjectLine,
        project_type: nextProjectType,
        project_scopes: nextScopes,
        project_stage: draft.project_stage,
        status: statusFromStage(draft.project_stage),
        owner_user_id: draft.owner_user_id,
      };

      let { data: updatedRow, error } = await supabase
        .from("projects")
        .update(updatePayload)
        .eq("id", projectId)
        .select("id")
        .maybeSingle();
      if (error && error.message.toLowerCase().includes("project_stage")) {
        const fallback = await supabase
          .from("projects")
          .update({
            name: updatePayload.name,
            description: updatePayload.description,
            start_date: updatePayload.start_date,
            end_date: updatePayload.end_date,
            budget_total: updatePayload.budget_total,
            client_id: updatePayload.client_id,
            project_line: updatePayload.project_line,
            project_type: updatePayload.project_type,
            project_scopes: updatePayload.project_scopes,
            status: updatePayload.status,
            owner_user_id: updatePayload.owner_user_id,
          })
          .eq("id", projectId)
          .select("id")
          .maybeSingle();
        error = fallback.error;
        updatedRow = fallback.data;
      }
      if (error) throw error;
      if (!updatedRow?.id) {
        throw new Error("Sem permissão para atualizar este projeto (verifique role/políticas RLS).");
      }

        for (const d of existingDeliverablesByProjectId[projectId] ?? []) {
          const values = deliverableValueDraftById[d.id];
          if (!values) continue;
          const nextCurrency =
            (values.currency_code ?? (d.currency_code === "USD" || d.currency_code === "EUR" ? d.currency_code : "BRL")) || "BRL";
          const nextActual =
            values.actual_amount !== undefined ? parseCurrencyInput(values.actual_amount) : (d.actual_amount ?? null);
          const nextDiscipline = (() => {
            if (values.discipline_code === undefined) return d.discipline_code ?? null;
            return values.discipline_code === "civil" || values.discipline_code === "bim" || values.discipline_code === "eletromecanico"
              ? values.discipline_code
              : null;
          })();
          const nextDueDate = values.due_date !== undefined ? ((values.due_date ?? "").trim() || null) : (d.due_date ?? null);
          const sameDiscipline = (d.discipline_code ?? null) === nextDiscipline;
          const sameCurrency = (d.currency_code || "BRL") === nextCurrency;
          const sameActual = (d.actual_amount ?? null) === (nextActual ?? null);
          const sameDueDate = (d.due_date ?? null) === nextDueDate;
          if (sameDiscipline && sameCurrency && sameActual && sameDueDate) continue;

          const updDeliverable = await supabase
            .from("project_deliverables")
            .update({
              discipline_code: nextDiscipline,
              currency_code: nextCurrency,
              actual_amount: nextActual,
              due_date: nextDueDate,
            })
            .eq("id", d.id)
            .eq("project_id", projectId);
        if (updDeliverable.error) throw updDeliverable.error;
      }

      await syncProjectManagers(projectId, [draft.owner_user_id, ...draft.secondary_manager_user_ids]);
      const createdDeliverables = await insertProjectDeliverables(projectId, newDeliverablesByProjectId[projectId] ?? [], budgetTotal);
      setNewDeliverablesByProjectId((prev) => ({ ...prev, [projectId]: [] }));

      setMsg(
        createdDeliverables > 0
          ? `Projeto atualizado com sucesso e ${createdDeliverables} entreg?vel(is) cadastrado(s) com disciplina.`
          : "Projeto atualizado com sucesso."
      );
      setEditingProjectId(null);
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? normalizeProjectMutationError(e.message) : "Erro ao atualizar projeto.");
    } finally {
      setSaving(false);
    }
  }

  function cancelExistingProjectEdit(project: ExistingProjectRow) {
    setDraftByProjectId((prev) => ({
      ...prev,
      [project.id]: {
        ...buildDraftFromProject(project),
        secondary_manager_user_ids: secondaryManagerByProjectId[project.id] ?? [],
      },
    }));
    setNewDeliverablesByProjectId((prev) => ({ ...prev, [project.id]: [] }));
    setOpenDeliverableValueEditorByProjectId((prev) => ({ ...prev, [project.id]: null }));
    setEditingProjectId(null);
  }

  return (
    <div className="space-y-6">
      <DiretoriaPageHeader
        icon={FolderPlus}
        title={isEditView ? "Diretoria - Projetos cadastrados" : "Diretoria - Novo projeto"}
        subtitle={
          isEditView
            ? "Edite projetos existentes, entregáveis, valores e prazos."
            : "Cadastro com direcionamento de gestor responsável."
        }
        action={
          <Link
            href="/diretoria/projetos"
            className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Voltar para acompanhamento
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/diretoria/projetos/novo"
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              !isEditView
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Novo projeto
          </Link>
          <Link
            href="/diretoria/projetos/cadastrados"
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              isEditView
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Projetos cadastrados
          </Link>
        </div>
      </div>

      {!isEditView ? (
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-white p-4 shadow-sm">
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 p-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Cadastro de projeto</h2>
              <p className="mt-1 text-xs text-indigo-100">
                Estruture o cadastro por blocos: contexto, responsáveis, planejamento, escopo e entregáveis.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-indigo-100">Gestao</div>
                <div className="font-semibold">1 ou 2 gestores</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-indigo-100">Entregaveis</div>
                <div className="font-semibold">Manual + CSV</div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Preencha os campos principais: <b>Empresa</b>, <b>Nome do projeto</b>, <b>Gestor responsável</b>,{" "}
          <b>Cliente</b>, <b>Tipo principal</b>, <b>Data de início</b> e <b>Previsão de término</b>.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-indigo-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Etapa inicial</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{stageLabel(newProjectStage)}</div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Gestao</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {`${1 + newProjectSecondaryManagerIds.length} gestor(es)`}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Orçamen?o</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{newProjectBudgetTotal || "N?o informado"}</div>
          </div>
          <div className="rounded-xl border border-violet-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Entregaveis iniciais</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{newProjectDeliverables.length}</div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
            <p className="text-xs font-semibold text-indigo-900">Contexto e direcionamento</p>
            <p className="mt-0.5 text-xs text-indigo-700">Defina empresa, cliente e gestores do projeto.</p>
          </div>
          <div className="md:col-span-2 rounded-xl border border-indigo-200 bg-white p-3 shadow-sm">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Selecione a empresa...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Empresa onde o projeto sera criado. Se ficar em branco, o admin opera em escopo global.
            </p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Nome do projeto</p>
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Nome do projeto"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">In?orme um nome curto e objetivo.</p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Gestor responsável</p>
            <select
              value={newProjectManagerId}
              onChange={(e) => {
                const nextOwnerId = e.target.value;
                setNewProjectManagerId(nextOwnerId);
                setNewProjectSecondaryManagerIds((prev) => prev.filter((id) => id !== nextOwnerId));
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Selecione o gestor responsável...</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {managerLabel(m)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Selecione quem vai conduzir o projeto.</p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Gestores adicionais (opcional)</p>
            <div className="max-h-40 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              {managers.filter((m) => m.id !== newProjectManagerId).length > 0 ? (
                managers
                  .filter((m) => m.id !== newProjectManagerId)
                  .map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                    >
                      <input
                        type="checkbox"
                        checked={newProjectSecondaryManagerIds.includes(m.id)}
                        onChange={() => toggleNewProjectAdditionalManager(m.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{managerLabel(m)}</span>
                    </label>
                  ))
              ) : (
                <p className="text-xs text-slate-500">N?o há outros gestores disponíveis para adicionar.</p>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">Marque quandos gestores adicionais forem necessarios no mesmo projeto.</p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Cliente</p>
            <select
              value={newProjectClientId}
              onChange={(e) => setNewProjectClientId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Selecione o cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Cliente contratante do projeto.</p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Linha do projeto</p>
            <select
              value={newProjectLine}
              onChange={(e) => setNewProjectLine(e.target.value as ProjectLine | "")}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Selecione a linha do projeto...</option>
              {PROJECT_LINE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Classificação da linha: Eólica, Solar ou BESS.</p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Modalidade do projeto</p>
            <select
              value={newProjectType}
              onChange={(e) => setNewProjectType(e.target.value as ProjectModality | "")}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Selecione a modalidade...</option>
              {PROJECT_MODALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Basico, Executivo, Eng. do proprietario ou Consultoria.</p>
          </div>

          <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs font-semibold text-emerald-900">Planejamento e valores</p>
            <p className="mt-0.5 text-xs text-emerald-700">Defina etapa, or?amento e datas de inicio/termino.</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Etapa inicial</p>
            <select
              value={newProjectStage}
              onChange={(e) => setNewProjectStage(e.target.value as ProjectStage)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="ofertas">Etapa inicial: Ofertas</option>
              <option value="desenvolvimento">Etapa inicial: Desenvolvimento</option>
              <option value="as_built">Etapa inicial: As Built</option>
              <option value="pausado">Etapa inicial: Pausado</option>
              <option value="cancelado">Etapa inicial: Cancelado</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Etapa atual em que o projeto comeca.</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Orçamen?o (R$)</p>
            <input
              value={newProjectBudgetTotal}
              onChange={(e) => setNewProjectBudgetTotal(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              inputMode="decimal"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Valor previsto total do contrato (opcional).</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Data de inicio</p>
            <input
              type="date"
              value={newProjectStart}
              onChange={(e) => setNewProjectStart(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Data de inicio planejada.</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Previsão de término</p>
            <input
              type="date"
              value={newProjectEnd}
              onChange={(e) => setNewProjectEnd(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Previsão de término do projeto.</p>
          </div>

          <div className="md:col-span-2 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-xs font-semibold text-slate-600">Descri??o do projeto</p>
            <input
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              placeholder="Descri??o (opcional)"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Resumo do escopo e objetivo principal (opcional).
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 md:col-span-2">
            <p className="text-xs font-semibold text-slate-700">Escopos/disciplinas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROJECT_SCOPE_OPTIONS_DIRETORIA.map((opt) => {
                const checked = newProjectScopes.includes(opt.value);
                return (
                  <label key={opt.value} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700">
                    <input type="checkbox" checked={checked} onChange={() => toggleProjectScope(opt.value)} />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">Entregaveis iniciais (opcional)</p>
                <p className="mt-1 text-xs text-slate-500">
                  Cadastre entregáveis já no momento da criação. Eles serão criados como pendentes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      "modelo_entregaveis_diretoria.csv",
                      "titulo_entregavel;previsao_entrega;descri??o;disciplina;moeda;valor_real\nPlano de execucao;28/02/2026;Descri??o do documento;civil;BRL;0,00",
                      "text/csv;charset=utf-8"
                    )
                  }
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Baixar modelo CSV
                </button>
                <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Importar CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) void importNewProjectDeliverablesFromCsv(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setNewProjectDeliverables((prev) => [...prev, newDeliverableDraft()])}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + Adicionar entreg?vel
                </button>
              </div>
            </div>
            {newProjectDeliverables.length > 0 ? (
              <div className="mt-3 space-y-2">
                {newProjectDeliverables.map((row) => (
                  <div key={row.temp_id} className="rounded-lg border border-violet-200 bg-white p-2">
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        value={row.title}
                        onChange={(e) =>
                          setNewProjectDeliverables((prev) =>
                            prev.map((item) => (item.temp_id === row.temp_id ? { ...item, title: e.target.value } : item))
                          )
                        }
                        placeholder="Título do entregável"
                        className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"
                      />
                      <input
                        type="date"
                        value={row.due_date}
                        onChange={(e) =>
                          setNewProjectDeliverables((prev) =>
                            prev.map((item) => (item.temp_id === row.temp_id ? { ...item, due_date: e.target.value } : item))
                          )
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                      <div className="md:col-span-3 flex gap-2">
                        <input
                          value={row.description}
                          onChange={(e) =>
                            setNewProjectDeliverables((prev) =>
                              prev.map((item) => (item.temp_id === row.temp_id ? { ...item, description: e.target.value } : item))
                            )
                          }
                          placeholder="Descri??o (opcional)"
                          className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
                        />
                        <select
                          value={row.discipline_code}
                          onChange={(e) =>
                            setNewProjectDeliverables((prev) =>
                              prev.map((item) =>
                                item.temp_id === row.temp_id
                                  ? {
                                      ...item,
                                      discipline_code:
                                        e.target.value === "civil" || e.target.value === "bim" || e.target.value === "eletromecanico"
                                          ? (e.target.value as DeliverableDiscipline)
                                          : "",
                                    }
                                  : item
                              )
                            )
                          }
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          <option value="">Disciplina...</option>
                          {DELIVERABLE_DISCIPLINE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={row.currency_code}
                          onChange={(e) =>
                            setNewProjectDeliverables((prev) =>
                              prev.map((item) =>
                                item.temp_id === row.temp_id
                                  ? { ...item, currency_code: e.target.value as "BRL" | "USD" | "EUR" }
                                  : item
                              )
                            )
                          }
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          <option value="BRL">BRL</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                        <input
                          value={row.actual_amount}
                          onChange={(e) =>
                            setNewProjectDeliverables((prev) =>
                              prev.map((item) =>
                                item.temp_id === row.temp_id ? { ...item, actual_amount: formatCurrencyInput(e.target.value) } : item
                              )
                            )
                          }
                          placeholder="Valor real"
                          inputMode="decimal"
                          className="h-10 w-36 rounded-xl border border-slate-200 px-3 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setNewProjectDeliverables((prev) => prev.filter((item) => item.temp_id !== row.temp_id))}
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Nenhum entregável inicial informado.</p>
            )}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Revise os blocos acima antes de salvar. Entregaveis iniciais serao criados como <b>pendentes</b>.
            </div>
            <button
              type="button"
              onClick={() => void createProject()}
              disabled={saving || loading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              Criar projeto
            </button>
          </div>
        </div>
      </div>
      ) : null}

      {isEditView ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Projetos cadastrados (edição)</h2>
          <p className="mt-1 text-xs text-slate-600">Edite dados, gestores e entregáveis em blocos segmentados.</p>
        </div>
        <div className="mt-3 space-y-3">
          {existingProjects.length ? (
            existingProjects.map((project) => {
              const draft = draftByProjectId[project.id];
              if (!draft) return null;
              const isProjectEditing = editingProjectId === project.id;
              return (
                <details key={project.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                    {project.name} - {stageLabel(project.project_stage)} - {managersById[project.owner_user_id] ?? project.owner_user_id.slice(0, 8)}
                  </summary>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-600">
                      {isProjectEditing
                        ? "Modo de edição ativo. Ajuste os campos abaixo e salve ao final."
                        : "Modo de visualização. Clique em Editar in?ormações para liberar alterações."}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!isProjectEditing ? (
                        <button
                          type="button"
                          onClick={() => setEditingProjectId(project.id)}
                          disabled={saving || loading}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Editar in?ormações
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deleteExistingProject(project)}
                        disabled={saving || loading}
                        className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Excluir projeto
                      </button>
                    </div>
                  </div>
                  <div
                    className={`mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2 ${
                      !isProjectEditing ? "pointer-events-none select-none" : ""
                    }`}
                  >
                    <div className="md:col-span-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Etapa</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{stageLabel(draft.project_stage)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Gestores</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {`${1 + draft.secondary_manager_user_ids.length} gestor(es)`}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Orçamen?o</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{draft.budget_total || "N?o informado"}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Entregaveis</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {(existingDeliverablesByProjectId[project.id] ?? []).length}
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                      <p className="text-xs font-semibold text-indigo-900">Dados e direcionamento</p>
                      <p className="mt-0.5 text-xs text-indigo-700">Ajuste nome, gestores, cliente e classificação principal.</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Nome do projeto</p>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, name: e.target.value } }))}
                        placeholder="Nome do projeto"
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Gestor responsável</p>
                      <select
                        value={draft.owner_user_id}
                        onChange={(e) => {
                          const nextOwnerId = e.target.value;
                          setDraftByProjectId((prev) => ({
                            ...prev,
                            [project.id]: {
                              ...draft,
                              owner_user_id: nextOwnerId,
                              secondary_manager_user_ids: draft.secondary_manager_user_ids.filter((id) => id !== nextOwnerId),
                            },
                          }));
                        }}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value="">Selecione o gestor responsável...</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {managerLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Gestores adicionais (opcional)</p>
                      <div className="max-h-40 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                        {managers.filter((m) => m.id !== draft.owner_user_id).length > 0 ? (
                          managers
                            .filter((m) => m.id !== draft.owner_user_id)
                            .map((m) => (
                              <label
                                key={m.id}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                              >
                                <input
                                  type="checkbox"
                                  checked={draft.secondary_manager_user_ids.includes(m.id)}
                                  onChange={() => toggleExistingAdditionalManager(project.id, m.id)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                <span>{managerLabel(m)}</span>
                              </label>
                            ))
                        ) : (
                          <p className="text-xs text-slate-500">N?o há outros gestores disponíveis para adicionar.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Cliente</p>
                      <select
                        value={draft.client_id}
                        onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, client_id: e.target.value } }))}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value="">Selecione o cliente...</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Linha do projeto</p>
                      <select
                        value={draft.project_line}
                        onChange={(e) =>
                          setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, project_line: e.target.value as ProjectLine | "" } }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value="">Selecione a linha do projeto...</option>
                        {PROJECT_LINE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Modalidade do projeto</p>
                      <select
                        value={draft.project_type}
                        onChange={(e) =>
                          setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, project_type: e.target.value as ProjectModality | "" } }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value="">Selecione a modalidade...</option>
                        {PROJECT_MODALITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-900">Planejamento do projeto</p>
                      <p className="mt-0.5 text-xs text-emerald-700">Etapa, orçamen?o e datas de referencia.</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Etapa inicial</p>
                      <select
                        value={draft.project_stage}
                        onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, project_stage: e.target.value as ProjectStage } }))}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value="ofertas">Ofertas</option>
                        <option value="desenvolvimento">Desenvolvimento</option>
                        <option value="as_built">As Built</option>
                        <option value="pausado">Pausado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Orçamen?o (R$)</p>
                      <input
                        value={draft.budget_total}
                        onChange={(e) =>
                          setDraftByProjectId((prev) => ({
                            ...prev,
                            [project.id]: { ...draft, budget_total: formatCurrencyInput(e.target.value) },
                          }))
                        }
                        placeholder="R$ 0,00"
                        inputMode="decimal"
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Data de inicio</p>
                      <input
                        type="date"
                        value={draft.start_date}
                        onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, start_date: e.target.value } }))}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-600">Previsão de término</p>
                      <input
                        type="date"
                        value={draft.end_date}
                        onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, end_date: e.target.value } }))}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <p className="mb-1 text-xs font-semibold text-slate-600">Descri??o do projeto</p>
                      <input
                        value={draft.description}
                        onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, description: e.target.value } }))}
                        placeholder="Descri??o (opcional)"
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <details className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 md:col-span-2" open>
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">Escopos/disciplinas</summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PROJECT_SCOPE_OPTIONS_DIRETORIA.map((opt) => {
                          const checked = draft.project_scopes.includes(opt.value);
                          return (
                            <label key={opt.value} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                              <input type="checkbox" checked={checked} onChange={() => toggleExistingScope(project.id, opt.value)} />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </details>
                    <details className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 md:col-span-2" open>
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">Entregaveis do projeto</summary>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="mt-1 text-xs text-slate-500">
                            Adicione novos entregáveis ao salvar a edição. Os existentes são listados abaixo.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              downloadTextFile(
                                "modelo_entregaveis_diretoria.csv",
                                "titulo_entregavel;previsao_entrega;descri??o;disciplina;moeda;valor_real\nPlano de execucao;28/02/2026;Descri??o do documento;civil;BRL;0,00",
                                "text/csv;charset=utf-8"
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Baixar modelo CSV
                          </button>
                          <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Importar CSV
                            <input
                              type="file"
                              accept=".csv,text/csv"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                if (file) void importDeliverablesFromCsv(project.id, file);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm(
                                "Isso vai sobrescrever o valor real de todos os entregáveis deste projeto com um novo rateio exato pelo orçamen?o. Deseja continuar?"
                              );
                              if (ok) void recalculateProjectDeliverablesRateio(project);
                            }}
                            disabled={saving || !(existingDeliverablesByProjectId[project.id] ?? []).length}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                          >
                            Recalcular rateio
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setNewDeliverablesByProjectId((prev) => ({
                                ...prev,
                                [project.id]: [...(prev[project.id] ?? []), newDeliverableDraft()],
                              }))
                            }
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            + Novo entreg?vel
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {(existingDeliverablesByProjectId[project.id] ?? []).length > 0 ? (
                          <div className="space-y-1">
                            {(() => {
                              const sortedDeliverables = [...(existingDeliverablesByProjectId[project.id] ?? [])].sort((a, b) => {
                                const aLocked = (a.financial_status ?? "aberto") !== "aberto";
                                const bLocked = (b.financial_status ?? "aberto") !== "aberto";
                                if (aLocked !== bLocked) return aLocked ? 1 : -1;

                                const aDueTs = Date.parse(String(a.due_date ?? ""));
                                const bDueTs = Date.parse(String(b.due_date ?? ""));
                                const aHasDue = Number.isFinite(aDueTs);
                                const bHasDue = Number.isFinite(bDueTs);
                                if (aHasDue && bHasDue && aDueTs !== bDueTs) return aDueTs - bDueTs;
                                if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;

                                return (a.title ?? "").localeCompare(b.title ?? "", "pt-BR", { sensitivity: "base" });
                              });

                              return sortedDeliverables.slice(0, 8).map((d) => (
                              <div key={d.id} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs shadow-sm">
                                {(() => {
                                  const totalDeliverables = Math.max(1, (existingDeliverablesByProjectId[project.id] ?? []).length);
                                  const fallbackPerDeliverable =
                                    d.actual_amount == null && (Number(project.budget_total) || 0) > 0
                                      ? (Number(project.budget_total) || 0) / totalDeliverables
                                      : null;
                                  const shownValue = d.actual_amount ?? fallbackPerDeliverable;
                                  const shownLabel = d.actual_amount == null && fallbackPerDeliverable != null ? "Real (rateio)" : "Real";

                                  return (
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        {openDeliverableValueEditorByProjectId[project.id] === d.id ? (
                                          <input
                                            value={deliverableValueDraftById[d.id]?.title ?? (d.title ?? "")}
                                            onChange={(e) =>
                                              setDeliverableValueDraftById((prev) => ({
                                                ...prev,
                                                [d.id]: {
                                                  title: e.target.value,
                                                  discipline_code:
                                                    prev[d.id]?.discipline_code ??
                                                    (d.discipline_code === "civil" || d.discipline_code === "eletromecanico"
                                                      ? d.discipline_code
                                                      : undefined),
                                                  currency_code:
                                                    (prev[d.id]?.currency_code ??
                                                      (d.currency_code === "USD" || d.currency_code === "EUR" ? d.currency_code : "BRL")) as
                                                      | "BRL"
                                                      | "USD"
                                                      | "EUR",
                                                  actual_amount:
                                                    prev[d.id]?.actual_amount ??
                                                    (d.actual_amount != null
                                                      ? new Intl.NumberFormat("pt-BR", {
                                                          style: "currency",
                                                          currency: "BRL",
                                                        }).format(Number(d.actual_amount))
                                                      : ""),
                                                  due_date: prev[d.id]?.due_date ?? (d.due_date ?? ""),
                                                },
                                              }))
                                            }
                                            placeholder="Título do entregável"
                                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800"
                                          />
                                        ) : (
                                          <div className="truncate font-medium text-slate-800">
                                            {(d.title ?? "").trim() || "Entreg?vel sem titulo"}
                                          </div>
                                        )}
                                        <div className="mt-1 grid gap-1 text-[11px] text-slate-600 md:grid-cols-[repeat(5,minmax(120px,max-content))]">
                                          <div className="whitespace-nowrap">
                                            <span className="text-slate-500">Prazo:</span> {formatDateBR(d.due_date)}
                                          </div>
                                          <div className="whitespace-nowrap">
                                            <span className="text-slate-500">Status:</span> {deliverableStatusLabel(d.status)}
                                          </div>
                                          <div className="whitespace-nowrap">
                                            <span className="text-slate-500">Horas:</span>{" "}
                                            {formatHoursAsHm(Number(deliverableHoursById[d.id] ?? 0) || 0)}
                                          </div>
                                          <div className="whitespace-nowrap">
                                            <span className="text-slate-500">Disciplina:</span>{" "}
                                            {deliverableDisciplineLabel(d.discipline_code)}
                                          </div>
                                          <div className="whitespace-nowrap">
                                            <span className="text-slate-500">Financeiro:</span>{" "}
                                            <span
                                              className={
                                                d.financial_status === "baixado"
                                                  ? "font-semibold text-emerald-700"
                                                  : d.financial_status === "pendente"
                                                    ? "font-semibold text-amber-700"
                                                    : ""
                                              }
                                            >
                                              {d.financial_status === "baixado"
                                                ? "Baixado"
                                                : d.financial_status === "pendente"
                                                  ? "Pendente"
                                                  : "Aberto"}
                                            </span>
                                          </div>
                                          <div className="whitespace-nowrap font-medium text-slate-700">
                                            <span className="text-slate-500 font-normal">{shownLabel}:</span>{" "}
                                            {formatDeliverableMoney(shownValue, d.currency_code)}
                                          </div>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openDeliverableValueEditor(project, d)}
                                        disabled={(d.financial_status ?? "aberto") !== "aberto"}
                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {(d.financial_status ?? "aberto") !== "aberto"
                                          ? "Bloqueado por boletim"
                                          : openDeliverableValueEditorByProjectId[project.id] === d.id
                                            ? "Fechar"
                                            : "Editar valor/prazo"}
                                      </button>
                                    </div>
                                  );
                                })()}
                                {openDeliverableValueEditorByProjectId[project.id] === d.id ? (
                                  <>
                                  <div className="mt-2 grid gap-2 md:grid-cols-12">
                                    <div className="md:col-span-4 text-xs text-slate-500 flex items-center">
                                      Deixe o valor em branco para manter vazio. Se n?o houver valor e a linha for aberta, o sistema sugere rateio pelo orçamen?o do projeto.
                                    </div>
                                    <input
                                      type="date"
                                      value={deliverableValueDraftById[d.id]?.due_date ?? (d.due_date ?? "")}
                                      onChange={(e) =>
                                        setDeliverableValueDraftById((prev) => ({
                                          ...prev,
                                          [d.id]: {
                                            title: prev[d.id]?.title ?? (d.title ?? ""),
                                            discipline_code:
                                              prev[d.id]?.discipline_code ??
                                              (d.discipline_code === "civil" || d.discipline_code === "eletromecanico" ? d.discipline_code : undefined),
                                            currency_code:
                                              (prev[d.id]?.currency_code ??
                                                (d.currency_code === "USD" || d.currency_code === "EUR" ? d.currency_code : "BRL")) as "BRL" | "USD" | "EUR",
                                            actual_amount:
                                              prev[d.id]?.actual_amount ??
                                              (d.actual_amount != null
                                                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.actual_amount))
                                                : ""),
                                            due_date: e.target.value,
                                          },
                                        }))
                                      }
                                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
                                    />
                                    <select
                                      value={
                                        (deliverableValueDraftById[d.id]?.discipline_code ??
                                          (d.discipline_code === "civil" || d.discipline_code === "eletromecanico" ? d.discipline_code : "")) as
                                          | DeliverableDiscipline
                                          | ""
                                      }
                                      onChange={(e) =>
                                        setDeliverableValueDraftById((prev) => ({
                                          ...prev,
                                          [d.id]: {
                                            title: prev[d.id]?.title ?? (d.title ?? ""),
                                            discipline_code:
                                              e.target.value === "civil" || e.target.value === "bim" || e.target.value === "eletromecanico"
                                                ? (e.target.value as DeliverableDiscipline)
                                                : undefined,
                                            currency_code:
                                              (prev[d.id]?.currency_code ??
                                                (d.currency_code === "USD" || d.currency_code === "EUR" ? d.currency_code : "BRL")) as "BRL" | "USD" | "EUR",
                                            actual_amount:
                                              prev[d.id]?.actual_amount ??
                                              (d.actual_amount != null
                                                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.actual_amount))
                                                : ""),
                                            due_date: prev[d.id]?.due_date ?? (d.due_date ?? ""),
                                          },
                                        }))
                                      }
                                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
                                    >
                                      <option value="">Disciplina...</option>
                                      {DELIVERABLE_DISCIPLINE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={
                                        (deliverableValueDraftById[d.id]?.currency_code ??
                                          (d.currency_code === "USD" || d.currency_code === "EUR" ? d.currency_code : "BRL")) as "BRL" | "USD" | "EUR"
                                      }
                                      onChange={(e) =>
                                        setDeliverableValueDraftById((prev) => ({
                                          ...prev,
                                          [d.id]: {
                                            title: prev[d.id]?.title ?? (d.title ?? ""),
                                            discipline_code:
                                              prev[d.id]?.discipline_code ??
                                              (d.discipline_code === "civil" || d.discipline_code === "eletromecanico" ? d.discipline_code : undefined),
                                            currency_code: e.target.value as "BRL" | "USD" | "EUR",
                                            actual_amount:
                                              prev[d.id]?.actual_amount ??
                                              (d.actual_amount != null
                                                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.actual_amount))
                                                : ""),
                                            due_date: prev[d.id]?.due_date ?? (d.due_date ?? ""),
                                          },
                                        }))
                                      }
                                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-1"
                                    >
                                      <option value="BRL">BRL</option>
                                      <option value="USD">USD</option>
                                      <option value="EUR">EUR</option>
                                    </select>
                                    <input
                                      value={
                                        deliverableValueDraftById[d.id]?.actual_amount ??
                                        (d.actual_amount != null
                                          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.actual_amount))
                                          : "")
                                      }
                                      onChange={(e) =>
                                        setDeliverableValueDraftById((prev) => ({
                                          ...prev,
                                          [d.id]: {
                                            title: prev[d.id]?.title ?? (d.title ?? ""),
                                            discipline_code:
                                              prev[d.id]?.discipline_code ??
                                              (d.discipline_code === "civil" || d.discipline_code === "eletromecanico" ? d.discipline_code : undefined),
                                            currency_code:
                                              (prev[d.id]?.currency_code ??
                                                (d.currency_code === "USD" || d.currency_code === "EUR" ? d.currency_code : "BRL")) as "BRL" | "USD" | "EUR",
                                            actual_amount: formatCurrencyInput(e.target.value),
                                            due_date: prev[d.id]?.due_date ?? (d.due_date ?? ""),
                                          },
                                        }))
                                      }
                                      placeholder="Valor real"
                                      inputMode="decimal"
                                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"
                                    />
                                    <div className="md:col-span-12 flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => requestSaveDeliverableInlineValue(project, d)}
                                        disabled={saving}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        Salvar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => cancelDeliverableInlineEditor(project.id, d.id)}
                                        disabled={saving}
                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                  {deliverableResidualPrompt &&
                                  deliverableResidualPrompt.project_id === project.id &&
                                  deliverableResidualPrompt.deliverable_id === d.id ? (
                                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                      {deliverableResidualPrompt.phase === "ask" ? (
                                        <div className="space-y-2">
                                          <p>
                                            Alterar este valor gera um residual de{" "}
                                            <span className="font-semibold">
                                              {formatDeliverableMoney(deliverableResidualPrompt.residual_amount, "BRL")}
                                            </span>{" "}
                                            no or?amento do projeto. Deseja ratear esse residual para os demais documentos com status financeiro aberto?
                                          </p>
                                          <div className="flex flex-wrap justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void persistDeliverableInlineValue(project, d, deliverableResidualPrompt.candidate_ids)}
                                              disabled={saving}
                                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 disabled:opacity-60"
                                            >
                                              Sim, ratear
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDeliverableResidualPrompt((prev) =>
                                                  prev &&
                                                  prev.project_id === project.id &&
                                                  prev.deliverable_id === d.id
                                                    ? { ...prev, phase: "select", selected_ids: [] }
                                                    : prev
                                                )
                                              }
                                              disabled={saving}
                                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-60"
                                            >
                                              N?o, escolher documentos
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setDeliverableResidualPrompt(null)}
                                              disabled={saving}
                                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-60"
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <p>
                                            Selecione os documentos com status financeiro aberto que receberao o valor residual (
                                            <span className="font-semibold">
                                              {formatDeliverableMoney(deliverableResidualPrompt.residual_amount, "BRL")}
                                            </span>
                                            ).
                                          </p>
                                          <div className="grid gap-2 md:grid-cols-2">
                                            {(existingDeliverablesByProjectId[project.id] ?? [])
                                              .filter((row) => deliverableResidualPrompt.candidate_ids.includes(row.id))
                                              .map((row) => {
                                                const checked = deliverableResidualPrompt.selected_ids.includes(row.id);
                                                return (
                                                  <label
                                                    key={row.id}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-2 py-1.5"
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      checked={checked}
                                                      onChange={() =>
                                                        setDeliverableResidualPrompt((prev) => {
                                                          if (
                                                            !prev ||
                                                            prev.project_id !== project.id ||
                                                            prev.deliverable_id !== d.id
                                                          ) {
                                                            return prev;
                                                          }
                                                          return {
                                                            ...prev,
                                                            selected_ids: checked
                                                              ? prev.selected_ids.filter((id) => id !== row.id)
                                                              : [...prev.selected_ids, row.id],
                                                          };
                                                        })
                                                      }
                                                    />
                                                    <span className="text-xs text-slate-700">
                                                      {(row.title ?? "").trim() || "Entreg?vel sem titulo"}
                                                    </span>
                                                  </label>
                                                );
                                              })}
                                          </div>
                                          <div className="flex flex-wrap justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void persistDeliverableInlineValue(
                                                  project,
                                                  d,
                                                  deliverableResidualPrompt.selected_ids
                                                )
                                              }
                                              disabled={saving || deliverableResidualPrompt.selected_ids.length === 0}
                                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 disabled:opacity-60"
                                            >
                                              Aplicar residual e salvar
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDeliverableResidualPrompt((prev) =>
                                                  prev &&
                                                  prev.project_id === project.id &&
                                                  prev.deliverable_id === d.id
                                                    ? { ...prev, phase: "ask" }
                                                    : prev
                                                )
                                              }
                                              disabled={saving}
                                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-60"
                                            >
                                              Voltar
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                  </>
                                ) : null}
                              </div>
                              ));
                            })()}
                            {(existingDeliverablesByProjectId[project.id] ?? []).length > 8 ? (
                              <p className="text-xs text-slate-500">
                                Mostrando 8 de {(existingDeliverablesByProjectId[project.id] ?? []).length} entregáveis.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Nenhum entreg?vel cadastrado ainda.</p>
                        )}

                        {(newDeliverablesByProjectId[project.id] ?? []).map((row) => (
                          <div key={row.temp_id} className="rounded-lg border border-violet-200 bg-white p-2 shadow-sm">
                            <div className="grid gap-2 md:grid-cols-3">
                              <input
                                value={row.title}
                                onChange={(e) =>
                                  setNewDeliverablesByProjectId((prev) => ({
                                    ...prev,
                                    [project.id]: (prev[project.id] ?? []).map((item) =>
                                      item.temp_id === row.temp_id ? { ...item, title: e.target.value } : item
                                    ),
                                  }))
                                }
                                placeholder="Título do entregável"
                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"
                              />
                              <input
                                type="date"
                                value={row.due_date}
                                onChange={(e) =>
                                  setNewDeliverablesByProjectId((prev) => ({
                                    ...prev,
                                    [project.id]: (prev[project.id] ?? []).map((item) =>
                                      item.temp_id === row.temp_id ? { ...item, due_date: e.target.value } : item
                                    ),
                                  }))
                                }
                                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                              />
                              <div className="md:col-span-3 flex gap-2">
                                <input
                                  value={row.description}
                                  onChange={(e) =>
                                    setNewDeliverablesByProjectId((prev) => ({
                                      ...prev,
                                      [project.id]: (prev[project.id] ?? []).map((item) =>
                                        item.temp_id === row.temp_id ? { ...item, description: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="Descri??o (opcional)"
                                  className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
                                />
                                <select
                                  value={row.discipline_code}
                                  onChange={(e) =>
                                    setNewDeliverablesByProjectId((prev) => ({
                                      ...prev,
                                      [project.id]: (prev[project.id] ?? []).map((item) =>
                                        item.temp_id === row.temp_id
                                          ? {
                                              ...item,
                                              discipline_code:
                                                e.target.value === "civil" || e.target.value === "bim" || e.target.value === "eletromecanico"
                                                  ? (e.target.value as DeliverableDiscipline)
                                                  : "",
                                            }
                                          : item
                                      ),
                                    }))
                                  }
                                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                >
                                  <option value="">Disciplina...</option>
                                  {DELIVERABLE_DISCIPLINE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={row.currency_code}
                                  onChange={(e) =>
                                    setNewDeliverablesByProjectId((prev) => ({
                                      ...prev,
                                      [project.id]: (prev[project.id] ?? []).map((item) =>
                                        item.temp_id === row.temp_id
                                          ? { ...item, currency_code: e.target.value as "BRL" | "USD" | "EUR" }
                                          : item
                                      ),
                                    }))
                                  }
                                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                >
                                  <option value="BRL">BRL</option>
                                  <option value="USD">USD</option>
                                  <option value="EUR">EUR</option>
                                </select>
                                <input
                                  value={row.actual_amount}
                                  onChange={(e) =>
                                    setNewDeliverablesByProjectId((prev) => ({
                                      ...prev,
                                      [project.id]: (prev[project.id] ?? []).map((item) =>
                                        item.temp_id === row.temp_id
                                          ? { ...item, actual_amount: formatCurrencyInput(e.target.value) }
                                          : item
                                      ),
                                    }))
                                  }
                                  placeholder="Valor real"
                                  inputMode="decimal"
                                  className="h-10 w-36 rounded-xl border border-slate-200 px-3 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNewDeliverablesByProjectId((prev) => ({
                                      ...prev,
                                      [project.id]: (prev[project.id] ?? []).filter((item) => item.temp_id !== row.temp_id),
                                    }))
                                  }
                                  className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                  {isProjectEditing ? (
                    <div className="mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void saveExistingProject(project.id)}
                          disabled={saving || loading}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                        >
                          Salvar edição
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelExistingProjectEdit(project)}
                          disabled={saving || loading}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Cancelar edição
                        </button>
                      </div>
                    </div>
                  ) : null}
                </details>
              );
            })
          ) : (
            <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-500">
              Nenhum projeto encontrado.
            </div>
          )}
        </div>
      </div>
      ) : null}

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}

