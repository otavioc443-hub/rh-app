"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PersonChip } from "@/components/people/PersonChip";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "admin";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "done";
  start_date: string | null;
  end_date: string | null;
  budget_total?: number | null;
  owner_user_id: string;
  company_id?: string | null;
  client_id?: string | null;
  project_type?: ProjectType | null;
  project_scopes?: string[] | null;
  created_at: string;
};

type ProjectType =
  | "hv"
  | "rmt"
  | "basico"
  | "estrutural"
  | "civil"
  | "eletromecanico"
  | "eletrico"
  | "hidraulico"
  | "outro";

type ProjectClient = {
  id: string;
  company_id: string | null;
  name: string;
  active: boolean;
};

type ProjectTeam = {
  id: string;
  project_id: string;
  name: string;
  coordinator_user_id: string | null;
  created_at: string;
};
type ProjectTeamMember = { id: string; team_id: string; project_id: string; user_id: string; created_at: string };

type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  member_role: "gestor" | "coordenador" | "colaborador";
};

type Deliverable = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assigned_to: string | null;
  status: "pending" | "in_progress" | "sent" | "approved" | "approved_with_comments";
  approval_comment: string | null;
  document_url: string | null;
  document_path: string | null;
  document_file_name: string | null;
  submitted_by: string | null;
};

type DeliverableTimelineRow = {
  id: string;
  deliverable_id: string;
  project_id: string;
  event_type: string;
  status_from: string | null;
  status_to: string | null;
  comment: string | null;
  actor_user_id: string | null;
  created_at: string;
};

type Contribution = {
  id: string;
  deliverable_id: string;
  user_id: string;
  contribution_note: string | null;
  created_at: string;
};

type DeliverableAssignee = {
  id: string;
  deliverable_id: string;
  project_id: string;
  user_id: string;
  contribution_unit: "hours" | "percent" | "points" | null;
  contribution_value: number | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  company_id?: string | null;
};

type Aggregates = {
  totalDocs: number;
  approvedDocs: number;
  sentDocs: number;
  progressApproved: number;
  progressSent: number;
  contributorCount: number;
};

type ProjectMemberDirectoryRow = {
  user_id: string;
  display_name: string;
  cargo: string | null;
  avatar_url: string | null;
};

type DeletedDeliverableItem = {
  id: string;
  source_module: "projects" | "pd_projects";
  project_id: string | null;
  deliverable_ref_id: string;
  title: string | null;
  description: string | null;
  due_date: string | null;
  status: string | null;
  deleted_by: string | null;
  deleted_at: string;
};

type DeletedTeamItem = {
  id: string;
  source_module: "projects" | "pd_projects";
  event_kind: "team_deleted" | "member_removed";
  project_id: string | null;
  team_name: string | null;
  user_id: string | null;
  deleted_by: string | null;
  deleted_at: string;
};

function isEmailLike(value: string) {
  return value.includes("@");
}

const PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType; label: string }> = [
  { value: "hv", label: "HV" },
  { value: "rmt", label: "RMT" },
  { value: "basico", label: "Basico" },
  { value: "estrutural", label: "Estrutural" },
  { value: "civil", label: "Civil" },
  { value: "eletromecanico", label: "Eletromecanico" },
  { value: "eletrico", label: "Eletrico" },
  { value: "hidraulico", label: "Hidraulico" },
  { value: "outro", label: "Outro" },
];

function projectTypeLabel(value: ProjectType | null | undefined) {
  const found = PROJECT_TYPE_OPTIONS.find((o) => o.value === value);
  return found?.label ?? "-";
}

function getDeliverableStatusEventType(statusFrom?: string | null, statusTo?: string | null) {
  const from = statusFrom ?? "";
  const to = statusTo ?? "";
  if ((from === "sent" || from === "approved_with_comments") && (to === "pending" || to === "in_progress")) {
    return "returned_for_rework";
  }
  return "status_changed";
}

function deliverableEventLabel(eventType: string) {
  if (eventType === "returned_for_rework") return "Retornou para ajuste";
  if (eventType === "status_changed") return "Mudanca de status";
  if (eventType === "created") return "Criado";
  if (eventType === "contribution_added") return "Contribuicao registrada";
  if (eventType === "contribution_approved") return "Contribuicao aprovada (interna)";
  if (eventType === "contribution_returned") return "Contribuicao retornada para ajuste (interna)";
  if (eventType === "assignee_added") return "Responsavel adicionado";
  if (eventType === "assignee_removed") return "Responsavel removido";
  if (eventType === "document_uploaded") return "Documento enviado";
  if (eventType === "document_linked") return "Link de documento atualizado";
  if (eventType === "document_link_updated") return "Link de documento atualizado";
  if (eventType === "document_updated") return "Documento enviado/atualizado";
  if (eventType === "file_uploaded") return "Arquivo enviado";
  return eventType;
}

function deliverableStatusLabel(value?: string | null) {
  if (value === "pending") return "Pendente";
  if (value === "in_progress") return "Em andamento";
  if (value === "sent") return "Enviado";
  if (value === "approved") return "Aprovado";
  if (value === "approved_with_comments") return "Aprovado com comentarios";
  if (value === "blocked") return "Bloqueado";
  if (value === "cancelled") return "Cancelado";
  return value ?? "-";
}

function formatDateTimeBR(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("pt-BR");
}

function parseDueDate(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const dt = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (br) {
    const dt = new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const brDash = /^(\d{2})-(\d{2})-(\d{4})/.exec(raw);
  if (brDash) {
    const dt = new Date(`${brDash[3]}-${brDash[2]}-${brDash[1]}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
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

export default function GestorProjetosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const assigneeFilter = useMemo(() => {
    const raw = searchParams.get("assignee");
    return raw ? raw.trim() : "";
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState<string>("");
  const [meCompanyId, setMeCompanyId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ProjectClient[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [deliverableAssignees, setDeliverableAssignees] = useState<DeliverableAssignee[]>([]);
  const [deliverableTimeline, setDeliverableTimeline] = useState<DeliverableTimelineRow[]>([]);
  const [deletedDeliverables, setDeletedDeliverables] = useState<DeletedDeliverableItem[]>([]);
  const [deletedTeamItems, setDeletedTeamItems] = useState<DeletedTeamItem[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [directoryById, setDirectoryById] = useState<Record<string, ProjectMemberDirectoryRow>>({});

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"coordenador" | "colaborador">("coordenador");
  const [memberRoleByMemberId, setMemberRoleByMemberId] = useState<Record<string, "coordenador" | "colaborador">>({});
  const [companyUsers, setCompanyUsers] = useState<Profile[]>([]);

  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docDueDate, setDocDueDate] = useState("");
  const [deliverableSearch, setDeliverableSearch] = useState("");
  const [deliverableSearchInput, setDeliverableSearchInput] = useState("");
  const [deliverableStatusDraft, setDeliverableStatusDraft] = useState<"all" | Deliverable["status"]>("all");
  const [deliverableSelectDraft, setDeliverableSelectDraft] = useState("");
  const [deliverableStatusFilter, setDeliverableStatusFilter] = useState<"all" | Deliverable["status"]>("all");
  const [deliverableSelectFilter, setDeliverableSelectFilter] = useState("");

  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignProjectRole, setAssignProjectRole] = useState<"coordenador" | "colaborador">("colaborador");
  const [teamNameDraftByTeamId, setTeamNameDraftByTeamId] = useState<Record<string, string>>({});
  const [teamCoordinatorDraftByTeamId, setTeamCoordinatorDraftByTeamId] = useState<Record<string, string>>({});
  const [teamEditOpenByTeamId, setTeamEditOpenByTeamId] = useState<Record<string, boolean>>({});
  const [teamAddMemberOpenByTeamId, setTeamAddMemberOpenByTeamId] = useState<Record<string, boolean>>({});

  const [editTitleByDeliverableId, setEditTitleByDeliverableId] = useState<Record<string, string>>({});
  const [editDescByDeliverableId, setEditDescByDeliverableId] = useState<Record<string, string>>({});
  const [editDueByDeliverableId, setEditDueByDeliverableId] = useState<Record<string, string>>({});
  const [docLinkByDeliverable, setDocLinkByDeliverable] = useState<Record<string, string>>({});
  const [timelineExpandedByDeliverableId, setTimelineExpandedByDeliverableId] = useState<Record<string, boolean>>({});
  const [openedDeliverableId, setOpenedDeliverableId] = useState<string | null>(null);
  const [deliverableActionById, setDeliverableActionById] = useState<Record<string, "status" | "edit" | "document" | null>>({});
  const [statusDraftByDeliverableId, setStatusDraftByDeliverableId] = useState<
    Record<string, Deliverable["status"]>
  >({});
  const [statusCommentByDeliverableId, setStatusCommentByDeliverableId] = useState<Record<string, string>>({});
  const [contribReviewCommentByDeliverableId, setContribReviewCommentByDeliverableId] = useState<Record<string, string>>({});

  const personLabel = useCallback((userId: string) => {
    const d = directoryById[userId];
    const name = (d?.display_name ?? "").trim();
    if (name && !isEmailLike(name)) return name;

    // Se ainda nao carregou o diretorio, usa apenas full_name (nunca email como label).
    const p = profilesById[userId];
    const n = (p?.full_name ?? "").trim();
    if (n && !isEmailLike(n)) return n;

    // Fallback final: nunca exibir e-mail inteiro.
    return `Colaborador ${userId.slice(0, 8)}`;
  }, [directoryById, profilesById]);

  const personCargo = useCallback((userId: string) => {
    const d = directoryById[userId];
    const cargo = (d?.cargo ?? "").trim();
    return cargo || "Cargo nao informado";
  }, [directoryById]);

  const personAvatar = useCallback((userId: string) => {
    const d = directoryById[userId];
    const url = typeof d?.avatar_url === "string" ? d.avatar_url.trim() : "";
    return url || null;
  }, [directoryById]);
  const assigneeLabel = useMemo(() => (assigneeFilter ? personLabel(assigneeFilter) : ""), [assigneeFilter, personLabel]);

  function clearAssigneeFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("assignee");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function safeNameFromProfile(u: Profile) {
    const full = (u.full_name ?? "").trim();
    if (full) return full;
    const email = (u.email ?? "").trim();
    if (email && email.includes("@")) return email.split("@")[0]?.trim() || `Colaborador ${String(u.id).slice(0, 8)}`;
    return `Colaborador ${String(u.id).slice(0, 8)}`;
  }

  async function loadMemberDirectory(projectId: string) {
    if (!projectId) {
      setDirectoryById({});
      return;
    }
    const { data, error } = await supabase.rpc("project_member_directory", { p_project_id: projectId });
    if (error) {
      setDirectoryById({});
      return;
    }
    const rows = (data ?? []) as ProjectMemberDirectoryRow[];
    const map: Record<string, ProjectMemberDirectoryRow> = {};
    for (const r of rows) map[String(r.user_id)] = r;
    setDirectoryById(map);
  }

  async function load() {
    setLoading(true);
    setClientsLoaded(false);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Nao autenticado.");
      const userId = authData.user.id;
      setMeId(userId);

      // Admin deve enxergar tudo (nao depender de membership/owner).
      let effectiveRole: Role | null = null;
      try {
        const { data: cr, error: crErr } = await supabase.rpc("current_role");
        if (!crErr) effectiveRole = (cr as Role) ?? null;
      } catch {
        // ignore
      }
      const isAdmin = effectiveRole === "admin";
      setIsAdmin(isAdmin);

      const meProfileRes = await supabase
        .from("profiles")
        .select("id,company_id,department_id,email")
        .eq("id", userId)
        .maybeSingle<{
          id: string;
          company_id: string | null;
          department_id: string | null;
          email: string | null;
        }>();
      if (meProfileRes.error) throw new Error(meProfileRes.error.message);
      let companyId = meProfileRes.data?.company_id ?? "";

      // Fallback 1: deriva empresa a partir do department_id em profiles
      if (!companyId && meProfileRes.data?.department_id) {
        const deptRes = await supabase
          .from("departments")
          .select("company_id")
          .eq("id", meProfileRes.data.department_id)
          .maybeSingle<{ company_id: string | null }>();
        if (!deptRes.error && deptRes.data?.company_id) {
          companyId = deptRes.data.company_id;
        }
      }

      // Fallback 2: tenta localizar colaborador por e-mail e derivar empresa
      if (!companyId && meProfileRes.data?.email) {
        const colabRes = await supabase
          .from("colaboradores")
          .select("*")
          .ilike("email", meProfileRes.data.email)
          .maybeSingle<Record<string, unknown>>();

        if (!colabRes.error && colabRes.data) {
          const directCompanyId =
            typeof colabRes.data.company_id === "string" ? colabRes.data.company_id : null;
          if (directCompanyId) {
            companyId = directCompanyId;
          } else {
            const depId =
              typeof colabRes.data.department_id === "string" ? colabRes.data.department_id : null;
            if (depId) {
              const deptRes = await supabase
                .from("departments")
                .select("company_id")
                .eq("id", depId)
                .maybeSingle<{ company_id: string | null }>();
              if (!deptRes.error && deptRes.data?.company_id) {
                companyId = deptRes.data.company_id;
              }
            }
          }
        }
      }

      setMeCompanyId(companyId);

      let ids: string[] = [];

      if (isAdmin) {
        const allRes = await supabase
          .from("projects")
          .select("id,name,description,status,start_date,end_date,budget_total,owner_user_id,company_id,client_id,project_type,project_scopes,created_at")
          .order("created_at", { ascending: false });
        if (allRes.error) throw new Error(allRes.error.message);
        const allProjects = (allRes.data ?? []) as Project[];
        ids = allProjects.map((p) => p.id);
      } else {
        const [ownedRes, memberRes] = await Promise.all([
          supabase
            .from("projects")
            .select("id,name,description,status,start_date,end_date,budget_total,owner_user_id,company_id,client_id,project_type,project_scopes,created_at")
            .eq("owner_user_id", userId)
            .order("created_at", { ascending: false }),
          supabase.from("project_members").select("id,project_id,user_id,member_role").eq("user_id", userId),
        ]);
        if (ownedRes.error) throw new Error(ownedRes.error.message);
        if (memberRes.error) throw new Error(memberRes.error.message);

        const ownedProjects = (ownedRes.data ?? []) as Project[];
        const myMembership = (memberRes.data ?? []) as ProjectMember[];
        ids = Array.from(new Set([...ownedProjects.map((p) => p.id), ...myMembership.map((m) => m.project_id)]));
      }

      if (ids.length === 0) {
        setProjects([]);
        setClients([]);
        setMembers([]);
        setDeliverables([]);
        setContributions([]);
        setDeliverableTimeline([]);
        setDeletedDeliverables([]);
        setDeletedTeamItems([]);
        setProfilesById({});
        setSelectedProjectId("");
        return;
      }

      const [projRes, memRes, delRes, deletedRes, deletedTeamsRes] = await Promise.all([
        supabase.from("projects").select("id,name,description,status,start_date,end_date,budget_total,owner_user_id,client_id,project_type,project_scopes,created_at").in("id", ids).order("created_at", { ascending: false }),
        supabase.from("project_members").select("id,project_id,user_id,member_role").in("project_id", ids),
        supabase.from("project_deliverables").select("id,project_id,title,description,due_date,assigned_to,status,approval_comment,document_url,document_path,document_file_name,submitted_by").in("project_id", ids).order("created_at", { ascending: false }),
        supabase
          .from("project_deliverable_deleted_items")
          .select("id,source_module,project_id,deliverable_ref_id,title,description,due_date,status,deleted_by,deleted_at")
          .eq("source_module", "projects")
          .in("project_id", ids)
          .order("deleted_at", { ascending: false }),
        supabase
          .from("project_team_deleted_items")
          .select("id,source_module,event_kind,project_id,team_name,user_id,deleted_by,deleted_at")
          .eq("source_module", "projects")
          .in("project_id", ids)
          .order("deleted_at", { ascending: false }),
      ]);
      if (projRes.error) throw new Error(projRes.error.message);
      if (memRes.error) throw new Error(memRes.error.message);
      if (delRes.error) throw new Error(delRes.error.message);

      const nextProjects = (projRes.data ?? []) as Project[];
      const nextMembers = (memRes.data ?? []) as ProjectMember[];
      const nextDeliverables = (delRes.data ?? []) as Deliverable[];
      setDeletedDeliverables((deletedRes.data ?? []) as DeletedDeliverableItem[]);
      setDeletedTeamItems((deletedTeamsRes.data ?? []) as DeletedTeamItem[]);
      setProjects(nextProjects);
      setMembers(nextMembers);
      setMemberRoleByMemberId((prev) => {
        const next = { ...prev };
        for (const m of nextMembers) {
          if (m.member_role === "coordenador" || m.member_role === "colaborador") {
            next[m.id] = next[m.id] ?? m.member_role;
          }
        }
        return next;
      });
      setDeliverables(nextDeliverables);
      setDocLinkByDeliverable(
        Object.fromEntries(nextDeliverables.map((d) => [d.id, d.document_url ?? ""]))
      );
      setStatusDraftByDeliverableId(
        Object.fromEntries(nextDeliverables.map((d) => [d.id, d.status])) as Record<string, Deliverable["status"]>
      );
      setStatusCommentByDeliverableId((prev) => {
        const next: Record<string, string> = {};
        for (const d of nextDeliverables) next[d.id] = prev[d.id] ?? d.approval_comment ?? "";
        return next;
      });
      setSelectedProjectId((prev) => (prev && nextProjects.some((p) => p.id === prev) ? prev : nextProjects[0]?.id ?? ""));

      setEditTitleByDeliverableId((prev) => {
        const next = { ...prev };
        for (const d of nextDeliverables) if (typeof next[d.id] !== "string") next[d.id] = d.title ?? "";
        return next;
      });
      setEditDescByDeliverableId((prev) => {
        const next = { ...prev };
        for (const d of nextDeliverables) if (typeof next[d.id] !== "string") next[d.id] = d.description ?? "";
        return next;
      });
      setEditDueByDeliverableId((prev) => {
        const next = { ...prev };
        for (const d of nextDeliverables) if (typeof next[d.id] !== "string") next[d.id] = d.due_date ?? "";
        return next;
      });

      let nextContributions: Contribution[] = [];
      let nextAssignees: DeliverableAssignee[] = [];
      let nextTimeline: DeliverableTimelineRow[] = [];
      if (nextDeliverables.length > 0) {
        const deliverableIds = nextDeliverables.map((d) => d.id);
        const [contribRes, assigneesRes, timelineRes] = await Promise.all([
          supabase
            .from("deliverable_contributions")
            .select("id,deliverable_id,user_id,contribution_note,created_at")
            .in("deliverable_id", deliverableIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("project_deliverable_assignees")
            .select("id,deliverable_id,project_id,user_id,contribution_unit,contribution_value")
            .in("deliverable_id", deliverableIds),
          supabase
            .from("project_deliverable_timeline")
            .select("id,deliverable_id,project_id,event_type,status_from,status_to,comment,actor_user_id,created_at")
            .in("deliverable_id", deliverableIds)
            .order("created_at", { ascending: false }),
        ]);
        if (contribRes.error) throw new Error(contribRes.error.message);
        nextContributions = (contribRes.data ?? []) as Contribution[];
        setContributions(nextContributions);
        if (!assigneesRes.error) {
          nextAssignees = (assigneesRes.data ?? []) as DeliverableAssignee[];
          setDeliverableAssignees(nextAssignees);
        } else {
          setDeliverableAssignees([]);
        }
        if (!timelineRes.error) {
          nextTimeline = (timelineRes.data ?? []) as DeliverableTimelineRow[];
          setDeliverableTimeline(nextTimeline);
        } else {
          setDeliverableTimeline([]);
        }
      } else {
        setContributions([]);
        setDeliverableAssignees([]);
        setDeliverableTimeline([]);
      }

      const userIds = Array.from(
        new Set([
          ...nextProjects.map((p) => p.owner_user_id),
          ...nextMembers.map((m) => m.user_id),
          ...nextDeliverables.map((d) => d.assigned_to).filter(Boolean),
          ...nextDeliverables.map((d) => d.submitted_by).filter(Boolean),
          ...((deletedRes.data ?? []) as DeletedDeliverableItem[]).map((d) => d.deleted_by).filter(Boolean),
          ...((deletedTeamsRes.data ?? []) as DeletedTeamItem[]).map((d) => d.deleted_by).filter(Boolean),
          ...((deletedTeamsRes.data ?? []) as DeletedTeamItem[]).map((d) => d.user_id).filter(Boolean),
          ...nextContributions.map((c) => c.user_id),
          ...nextTimeline.map((t) => t.actor_user_id).filter(Boolean),
        ].filter(Boolean) as string[])
      );
      if (userIds.length > 0) {
        const profRes = await supabase.from("profiles").select("id,full_name,email,role,company_id").in("id", userIds);
        if (!profRes.error) {
          const map: Record<string, Profile> = {};
          for (const p of (profRes.data ?? []) as Profile[]) map[p.id] = p;
          setProfilesById(map);
        }
      } else {
        setProfilesById({});
      }

      if (companyId) {
        const usersRes = await supabase
          .from("profiles")
          .select("id,full_name,email,role,company_id")
          .eq("active", true)
          .eq("company_id", companyId)
          .in("role", ["coordenador", "colaborador"])
          .order("full_name", { ascending: true });
        if (usersRes.error) throw new Error(usersRes.error.message);
        setCompanyUsers((usersRes.data ?? []) as Profile[]);
      } else {
        setCompanyUsers([]);
      }

      const clientsRes = await supabase
        .from("project_clients")
        .select("id,company_id,name,active")
        .eq("active", true)
        .order("name", { ascending: true });
      if (clientsRes.error) throw new Error(clientsRes.error.message);
      setClients((clientsRes.data ?? []) as ProjectClient[]);
      setClientsLoaded(true);
    } catch (e: unknown) {
      setClientsLoaded(true);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar projetos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadMemberDirectory(selectedProjectId);
  }, [selectedProjectId]);

  const selectedMembers = useMemo(
    () => members.filter((m) => m.project_id === selectedProjectId),
    [members, selectedProjectId]
  );

  const teamCandidateOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; defaultRole: "coordenador" | "colaborador" }>();

    for (const m of selectedMembers) {
      map.set(m.user_id, {
        id: m.user_id,
        label: `${personLabel(m.user_id)} (${m.member_role})`,
        defaultRole: m.member_role === "coordenador" ? "coordenador" : "colaborador",
      });
    }

    for (const u of companyUsers) {
      const id = String(u.id);
      if (!id) continue;
      if (map.has(id)) continue;
      const role = (u.role ?? "colaborador") === "coordenador" ? "coordenador" : "colaborador";
      map.set(id, {
        id,
        label: `${safeNameFromProfile(u)} (${u.role ?? "colaborador"})`,
        defaultRole: role,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [selectedMembers, companyUsers, personLabel]);

  const projectCoordinatorOptions = useMemo(() => {
    return selectedMembers
      .filter((m) => m.member_role === "coordenador")
      .map((m) => ({ id: m.user_id, label: personLabel(m.user_id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [selectedMembers, personLabel]);

  useEffect(() => {
    if (!assignUserId) return;
    const opt = teamCandidateOptions.find((x) => x.id === assignUserId) ?? null;
    if (opt) setAssignProjectRole(opt.defaultRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignUserId]);

  const selectedDeliverables = useMemo(
    () => deliverables.filter((d) => d.project_id === selectedProjectId),
    [deliverables, selectedProjectId]
  );
  const applyDeliverableFilters = useCallback(() => {
    setDeliverableSearch(deliverableSearchInput);
    setDeliverableStatusFilter(deliverableStatusDraft);
    setDeliverableSelectFilter(deliverableSelectDraft);
  }, [
    deliverableSearchInput,
    deliverableStatusDraft,
    deliverableSelectDraft,
  ]);
  const filteredSelectedDeliverables = useMemo(() => {
    const search = deliverableSearch.trim().toLowerCase();
    return selectedDeliverables.filter((d) => {
      const byAssignee = assigneeFilter ? d.assigned_to === assigneeFilter : true;
      const bySelect = deliverableSelectFilter ? d.id === deliverableSelectFilter : true;
      const byStatus = deliverableStatusFilter === "all" ? true : d.status === deliverableStatusFilter;
      const bySearch = search
        ? `${d.title} ${d.description ?? ""}`.toLowerCase().includes(search)
        : true;
      return byAssignee && bySelect && byStatus && bySearch;
    });
  }, [selectedDeliverables, assigneeFilter, deliverableSelectFilter, deliverableStatusFilter, deliverableSearch]);
  const selectedDeletedDeliverables = useMemo(
    () =>
      deletedDeliverables
        .filter((d) => d.project_id === selectedProjectId && d.source_module === "projects")
        .sort((a, b) => +new Date(b.deleted_at) - +new Date(a.deleted_at)),
    [deletedDeliverables, selectedProjectId]
  );
  const selectedDeletedTeamItems = useMemo(
    () =>
      deletedTeamItems
        .filter((d) => d.project_id === selectedProjectId && d.source_module === "projects")
        .sort((a, b) => +new Date(b.deleted_at) - +new Date(a.deleted_at)),
    [deletedTeamItems, selectedProjectId]
  );

  async function loadTeams(projectId: string) {
    if (!projectId) {
      setTeams([]);
      setTeamMembers([]);
      return;
    }
    try {
      const [tRes, tmRes] = await Promise.all([
        supabase
          .from("project_teams")
          .select("id,project_id,name,coordinator_user_id,created_at")
          .eq("project_id", projectId)
          .order("name", { ascending: true }),
        supabase.from("project_team_members").select("id,team_id,project_id,user_id,created_at").eq("project_id", projectId),
      ]);
      if (tRes.error) throw tRes.error;
      if (tmRes.error) throw tmRes.error;
      const loadedTeams = (tRes.data ?? []) as ProjectTeam[];
      setTeams(loadedTeams);
      setTeamMembers((tmRes.data ?? []) as ProjectTeamMember[]);
      setTeamCoordinatorDraftByTeamId(() => {
        const next: Record<string, string> = {};
        for (const t of loadedTeams) next[t.id] = t.coordinator_user_id ?? "";
        return next;
      });
      setAssignTeamId((prev) => (prev && (tRes.data ?? []).some((t) => t.id === prev) ? prev : String((tRes.data ?? [])[0]?.id ?? "")));
    } catch {
      // tabela pode nao existir ainda (SQL nao aplicado)
      setTeams([]);
      setTeamMembers([]);
    }
  }

  useEffect(() => {
    void loadTeams(selectedProjectId);
  }, [selectedProjectId]);

  const aggregatesByProject = useMemo(() => {
    const byProject = new Map<string, Aggregates>();
    for (const p of projects) {
      const docs = deliverables.filter((d) => d.project_id === p.id);
      const totalDocs = docs.length;
      const approvedDocs = docs.filter((d) => d.status === "approved" || d.status === "approved_with_comments").length;
      const sentDocs = docs.filter(
        (d) => d.status === "sent" || d.status === "approved" || d.status === "approved_with_comments"
      ).length;
      const docIds = docs.map((d) => d.id);
      const contributorCount = new Set(
        contributions.filter((c) => docIds.includes(c.deliverable_id)).map((c) => c.user_id)
      ).size;
      byProject.set(p.id, {
        totalDocs,
        approvedDocs,
        sentDocs,
        progressApproved: totalDocs ? Math.round((approvedDocs / totalDocs) * 100) : 0,
        progressSent: totalDocs ? Math.round((sentDocs / totalDocs) * 100) : 0,
        contributorCount,
      });
    }
    return byProject;
  }, [projects, deliverables, contributions]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clients) map[c.id] = c.name;
    return map;
  }, [clients]);
  const selectedProjectClientLabel = useMemo(() => {
    if (!selectedProject?.client_id) return "-";
    if (!clientsLoaded) return "Carregando...";
    return clientNameById[selectedProject.client_id] ?? "Cliente nao encontrado";
  }, [selectedProject?.client_id, clientsLoaded, clientNameById]);

  async function addMember() {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    if (!memberUserId) return setMsg("Selecione o colaborador/coordenador.");
    setSaving(true);
    setMsg("");
    try {
      const selected = companyUsers.find((u) => u.id === memberUserId);
      if (!selected) throw new Error("Usuario selecionado nao encontrado.");
      const insertRes = await supabase.from("project_members").insert({
        project_id: selectedProjectId,
        user_id: selected.id,
        member_role: memberRole,
        added_by: meId || null,
      });
      if (insertRes.error) throw new Error(insertRes.error.message);
      setMemberUserId("");
      setMsg("Membro adicionado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao adicionar membro.");
    } finally {
      setSaving(false);
    }
  }

  async function addDeliverable() {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    if (!docTitle.trim()) return setMsg("Informe o titulo do documento entregavel.");
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        project_id: selectedProjectId,
        title: docTitle.trim(),
        description: docDescription.trim() || null,
        due_date: docDueDate || null,
        // Gestor cria o entregavel; direcionamento de responsavel e' do Coordenador.
        assigned_to: null,
        status: "pending",
      };
      const res = await supabase.from("project_deliverables").insert(payload).select("id").single();
      if (res.error) throw new Error(res.error.message);
      await logDeliverableEvent({
        deliverableId: String(res.data.id),
        projectId: selectedProjectId,
        eventType: "created",
        statusTo: "pending",
      });
      setDocTitle("");
      setDocDescription("");
      setDocDueDate("");
      setMsg("Entregavel criado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar entregavel.");
    } finally {
      setSaving(false);
    }
  }

  async function updateDeliverableStatus(
    id: string,
    status: Deliverable["status"],
    timelineComment?: string | null
  ) {
    setSaving(true);
    setMsg("");
    try {
      const current = deliverables.find((x) => x.id === id) ?? null;
      const currentStatus = current?.status ?? null;
      const needsAutoSentStep =
        currentStatus === "in_progress" && (status === "approved" || status === "approved_with_comments");
      if (needsAutoSentStep) {
        const sentRes = await supabase.from("project_deliverables").update({ status: "sent" }).eq("id", id);
        if (sentRes.error) throw new Error(sentRes.error.message);
        await logDeliverableEvent({
          deliverableId: id,
          projectId: current?.project_id ?? selectedProjectId,
          eventType: getDeliverableStatusEventType(currentStatus, "sent"),
          statusFrom: currentStatus,
          statusTo: "sent",
        });
      }
      const fromStatus = needsAutoSentStep ? "sent" : currentStatus;
      const res = await supabase.from("project_deliverables").update({ status }).eq("id", id);
      if (res.error) throw new Error(res.error.message);
        await logDeliverableEvent({
          deliverableId: id,
          projectId: current?.project_id ?? selectedProjectId,
          eventType: getDeliverableStatusEventType(fromStatus, status),
          statusFrom: fromStatus,
          statusTo: status,
          comment: timelineComment ?? null,
        });
        setOpenedDeliverableId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Erro ao atualizar status.");
      } finally {
        setSaving(false);
    }
  }

  async function updateDocumentLink(id: string, link: string) {
    setSaving(true);
    setMsg("");
    try {
      const current = deliverables.find((x) => x.id === id) ?? null;
      const nextLink = link.trim();
      const currentLink = (current?.document_url ?? "").trim();
      if (nextLink === currentLink) return;

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      const response = await fetch("/api/projects/deliverables/link", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          deliverable_id: id,
          document_url: nextLink,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Nao foi possivel atualizar o link do documento.");
      }

      await logDeliverableEvent({
        deliverableId: id,
        projectId: current?.project_id ?? selectedProjectId,
        eventType: "document_link_updated",
        comment: nextLink ? "Link atualizado." : "Link removido.",
      });
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar documento.");
    } finally {
      setSaving(false);
    }
  }

    async function saveDeliverableEdits(deliverableId: string) {
    setSaving(true);
    setMsg("");
    try {
      const current = deliverables.find((x) => x.id === deliverableId) ?? null;
      const payload = {
        title: (editTitleByDeliverableId[deliverableId] ?? "").trim() || null,
        description: (editDescByDeliverableId[deliverableId] ?? "").trim() || null,
        due_date: (editDueByDeliverableId[deliverableId] ?? "").trim() || null,
      };
      const res = await supabase.from("project_deliverables").update(payload).eq("id", deliverableId);
      if (res.error) throw new Error(res.error.message);
        await logDeliverableEvent({
          deliverableId,
          projectId: current?.project_id ?? selectedProjectId,
          eventType: "edited",
          comment: "Entregavel atualizado (titulo/descricao/prazo).",
        });
        setMsg("Entregavel atualizado.");
        setOpenedDeliverableId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Erro ao atualizar entregavel.");
      } finally {
        setSaving(false);
    }
  }

  async function updateMemberRole(projectMemberId: string) {
    const member = members.find((m) => m.id === projectMemberId) ?? null;
    if (!member) return setMsg("Membro nao encontrado.");
    if (member.member_role === "gestor") return setMsg("O papel de gestor nao pode ser alterado nesta tela.");
    const nextRole = memberRoleByMemberId[projectMemberId] ?? (member.member_role as "coordenador" | "colaborador");
    if (nextRole === member.member_role) return setMsg("Nenhuma alteracao de funcao para salvar.");
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase
        .from("project_members")
        .update({ member_role: nextRole })
        .eq("id", projectMemberId);
      if (res.error) throw new Error(res.error.message);
      let syncCount = 0;
      if (nextRole === "colaborador" && selectedProjectId) {
        const projectDeliverables = deliverables.filter((d) => d.project_id === selectedProjectId);
        const deliverableIds = projectDeliverables.map((d) => d.id);
        if (deliverableIds.length > 0) {
          const existingRes = await supabase
            .from("project_deliverable_assignees")
            .select("deliverable_id")
            .eq("user_id", member.user_id)
            .in("deliverable_id", deliverableIds);
          if (existingRes.error) throw new Error(existingRes.error.message);
          const alreadyAssigned = new Set(
            ((existingRes.data ?? []) as Array<{ deliverable_id: string }>).map((r) => r.deliverable_id)
          );
          const missingIds = deliverableIds.filter((id) => {
            if (alreadyAssigned.has(id)) return false;
            const del = projectDeliverables.find((d) => d.id === id);
            return del?.assigned_to !== member.user_id;
          });
          if (missingIds.length > 0) {
            const payload = missingIds.map((id) => ({
              deliverable_id: id,
              project_id: selectedProjectId,
              user_id: member.user_id,
              contribution_unit: "hours" as const,
              contribution_value: null,
              created_by: meId || null,
            }));
            const ins = await supabase.from("project_deliverable_assignees").insert(payload);
            if (ins.error) throw new Error(ins.error.message);
            syncCount = missingIds.length;
          }
        }
      }
      setMsg(
        syncCount > 0
          ? `Funcao do membro atualizada. ${syncCount} entregavel(is) sincronizado(s) como pessoa atribuida.`
          : "Funcao do membro atualizada."
      );
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar funcao do membro.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(projectMemberId: string) {
    const member = members.find((m) => m.id === projectMemberId) ?? null;
    if (!member) return setMsg("Membro nao encontrado.");
    if (member.member_role === "gestor") return setMsg("O gestor do projeto nao pode ser removido nesta tela.");
    if (member.user_id === meId) return setMsg("Voce nao pode remover o proprio acesso.");
    if (!confirm(`Remover ${personLabel(member.user_id)} deste projeto?`)) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_members").delete().eq("id", projectMemberId);
      if (res.error) throw new Error(res.error.message);
      setMsg("Membro removido do projeto.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao remover membro.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraftStatus(deliverableId: string, draftStatus: Deliverable["status"]) {
    const current = deliverables.find((x) => x.id === deliverableId) ?? null;
    if (!current) return;
    const nextStatus = draftStatus;
    const comment = (statusCommentByDeliverableId[deliverableId] ?? "").trim() || null;
    if (nextStatus === current.status) {
      setMsg("Selecione um status diferente para salvar.");
      return;
    }
    await updateDeliverableStatus(deliverableId, nextStatus, comment);
    setStatusCommentByDeliverableId((prev) => ({ ...prev, [deliverableId]: "" }));
  }

  async function reviewContribution(deliverable: Deliverable, decision: "approve" | "return") {
    const comment = (contribReviewCommentByDeliverableId[deliverable.id] ?? "").trim();
    if (decision === "return" && !comment) {
      return setMsg("Informe comentario para retornar a contribuicao.");
    }
    setSaving(true);
    setMsg("");
    try {
      await logDeliverableEvent({
        deliverableId: deliverable.id,
        projectId: deliverable.project_id,
        eventType: decision === "approve" ? "contribution_approved" : "contribution_returned",
        comment: comment || (decision === "approve" ? "Contribuicao validada internamente." : null),
      });
      if (decision === "return") {
        const upd = await supabase
          .from("project_deliverables")
          .update({ status: "in_progress" })
          .eq("id", deliverable.id);
        if (upd.error) throw new Error(upd.error.message);
      }
      setContribReviewCommentByDeliverableId((prev) => ({ ...prev, [deliverable.id]: "" }));
      setMsg(decision === "approve" ? "Contribuicao aprovada internamente." : "Contribuicao retornada para ajuste.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao validar contribuicao.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDeliverable(deliverableId: string) {
    if (!confirm("Excluir este entregavel? Esta acao nao pode ser desfeita.")) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_deliverables").delete().eq("id", deliverableId);
      if (res.error) throw new Error(res.error.message);
        setMsg("Entregavel excluido.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir entregavel.");
    } finally {
      setSaving(false);
    }
  }

  async function importDeliverablesFromCsv(file: File) {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
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
        ["titulo_entregavel", "titulo", "entregavel", "title"].includes(h)
      );
      const dueIdx = headers.findIndex((h) =>
        ["previsao_entrega", "prazo", "due_date", "data_previsao", "data_entrega"].includes(h)
      );
      const descIdx = headers.findIndex((h) =>
        ["descricao", "description", "detalhes"].includes(h)
      );
      if (titleIdx < 0) {
        throw new Error("CSV invalido: cabecalho deve conter a coluna de titulo do entregavel.");
      }

      const rows = lines
        .slice(1)
        .map((line) => parseCsvLine(line, delimiter))
        .map((cols) => {
          const title = (cols[titleIdx] ?? "").trim();
          const dueDate = dueIdx >= 0 ? normalizeCsvDate(cols[dueIdx] ?? "") : null;
          const description = descIdx >= 0 ? (cols[descIdx] ?? "").trim() : "";
          return { title, dueDate, description };
        })
        .filter((r) => r.title.length > 0);

      if (rows.length === 0) {
        throw new Error("Nenhuma linha valida encontrada. Preencha ao menos o titulo do entregavel.");
      }

      const payload = rows.map((r) => ({
        project_id: selectedProjectId,
        title: r.title,
        description: r.description || null,
        due_date: r.dueDate,
        assigned_to: null,
        status: "pending" as const,
      }));

      const ins = await supabase
        .from("project_deliverables")
        .insert(payload)
        .select("id,project_id");
      if (ins.error) throw new Error(ins.error.message);

      const created = (ins.data ?? []) as Array<{ id: string; project_id: string }>;
      if (created.length > 0) {
        await supabase.from("project_deliverable_timeline").insert(
          created.map((r) => ({
            deliverable_id: r.id,
            project_id: r.project_id,
            event_type: "created",
            status_to: "pending",
            comment: "Entregavel criado via importacao CSV.",
            actor_user_id: meId || null,
          }))
        );
      }

      setMsg(`${created.length} entregavel(eis) importado(s) com sucesso.`);
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao importar CSV de entregaveis.");
    } finally {
      setSaving(false);
    }
  }

  async function logDeliverableEvent(params: {
    deliverableId: string;
    projectId: string;
    eventType: string;
    statusFrom?: string | null;
    statusTo?: string | null;
    comment?: string | null;
  }) {
    try {
      await supabase.from("project_deliverable_timeline").insert({
        deliverable_id: params.deliverableId,
        project_id: params.projectId,
        event_type: params.eventType,
        status_from: params.statusFrom ?? null,
        status_to: params.statusTo ?? null,
        comment: params.comment ?? null,
        actor_user_id: meId || null,
      });
    } catch {
      // nao bloqueia o fluxo principal
    }
  }

  async function openDeliverableFile(deliverableId: string) {
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      const qs = new URLSearchParams({ deliverable_id: deliverableId });
      const res = await fetch(`/api/projects/deliverables/file-url?${qs.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = (await res.json()) as { ok?: boolean; signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) throw new Error(json.error || `Erro ao gerar link (status ${res.status})`);
      window.open(json.signedUrl, "_blank", "noreferrer");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir arquivo.");
    }
  }

  async function createTeam() {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    const name = newTeamName.trim();
    if (!name) return setMsg("Informe o nome da equipe.");
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase
        .from("project_teams")
        .insert({
          project_id: selectedProjectId,
          name,
          created_by: meId || null,
        });
      if (res.error) throw new Error(res.error.message);
      setNewTeamName("");
      setMsg("Equipe criada.");
      await loadTeams(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function addMemberToTeam(forcedTeamId?: string) {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    const teamId = forcedTeamId ?? assignTeamId;
    if (!teamId) return setMsg("Selecione uma equipe.");
    if (!assignUserId) return setMsg("Selecione um colaborador.");
    setSaving(true);
    setMsg("");
    try {
      // Garante membership no projeto antes de inserir em equipe (RLS exige isso).
      const alreadyMember = selectedMembers.some((m) => m.user_id === assignUserId);
      if (!alreadyMember) {
        const insMem = await supabase.from("project_members").insert({
          project_id: selectedProjectId,
          user_id: assignUserId,
          member_role: assignProjectRole,
          added_by: meId || null,
        });
        if (insMem.error) throw new Error(insMem.error.message);
      }

        const res = await supabase.from("project_team_members").insert({
          team_id: teamId,
          project_id: selectedProjectId,
          user_id: assignUserId,
          added_by: meId || null,
      });
      if (res.error) {
        if ((res.error as { code?: string })?.code === "23505") {
          throw new Error("Este colaborador ja esta nesta equipe.");
        }
        throw new Error(res.error.message);
      }
      setAssignUserId("");
      setMsg("Membro adicionado na equipe.");
      await load(); // atualiza project_members se foi inserido acima
      await loadTeams(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao adicionar membro na equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTeamMember(row: ProjectTeamMember) {
    if (!confirm("Remover este membro da equipe?")) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_team_members").delete().eq("id", row.id);
      if (res.error) throw new Error(res.error.message);
      await loadTeams(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao remover membro da equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam(teamId: string) {
    if (!confirm("Excluir esta equipe?")) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_teams").delete().eq("id", teamId);
      if (res.error) throw new Error(res.error.message);
      await loadTeams(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTeamName(teamId: string) {
    const current = teams.find((t) => t.id === teamId) ?? null;
    if (!current) return;
    const nextName = (teamNameDraftByTeamId[teamId] ?? current.name ?? "").trim();
    const nextCoordinatorId = (teamCoordinatorDraftByTeamId[teamId] ?? current.coordinator_user_id ?? "").trim();
    if (!nextName) return setMsg("Informe o nome da equipe.");
    if (nextName === (current.name ?? "").trim() && nextCoordinatorId === (current.coordinator_user_id ?? "")) {
      return setMsg("Nenhuma alteracao para salvar.");
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase
        .from("project_teams")
        .update({ name: nextName, coordinator_user_id: nextCoordinatorId || null })
        .eq("id", teamId);
      if (res.error) throw new Error(res.error.message);
      setMsg("Equipe atualizada.");
      await loadTeams(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar nome da equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function promoteTeamMemberToCoordinator(teamId: string, userId: string) {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    const team = teams.find((t) => t.id === teamId) ?? null;
    if (!team) return setMsg("Equipe nao encontrada.");
    if (team.coordinator_user_id === userId) return setMsg("Este membro ja e o coordenador da equipe.");

    const member = selectedMembers.find((m) => m.user_id === userId) ?? null;
    if (!member) return setMsg("Membro do projeto nao encontrado.");

    setSaving(true);
    setMsg("");
    try {
      if (member.member_role !== "coordenador") {
        const roleRes = await supabase.from("project_members").update({ member_role: "coordenador" }).eq("id", member.id);
        if (roleRes.error) throw new Error(roleRes.error.message);
      }

      const teamRes = await supabase.from("project_teams").update({ coordinator_user_id: userId }).eq("id", teamId);
      if (teamRes.error) throw new Error(teamRes.error.message);

      setMsg(`"${personLabel(userId)}" definido como coordenador da equipe "${team.name}".`);
      await load();
      await loadTeams(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao definir coordenador da equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function clearTeamCoordinator(teamId: string, userId: string) {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    const team = teams.find((t) => t.id === teamId) ?? null;
    if (!team) return setMsg("Equipe nao encontrada.");
    if (team.coordinator_user_id !== userId) return setMsg("Este membro nao e o coordenador atual da equipe.");

    setSaving(true);
    setMsg("");
    try {
      const teamRes = await supabase.from("project_teams").update({ coordinator_user_id: null }).eq("id", teamId);
      if (teamRes.error) throw new Error(teamRes.error.message);
      setMsg(`Coordenacao removida da equipe "${team.name}".`);
      await loadTeams(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao remover coordenacao da equipe.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Projetos</h1>
            <p className="mt-1 text-sm text-slate-600">
              Monte equipe e acompanhe entregas/documentos por percentual.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Projeto selecionado</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Selecione um projeto...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedProject ? (
          <div className="rounded-2xl border border-slate-900 bg-slate-900 p-6 text-white">
            <p className="text-3xl font-semibold">{selectedProject.name}</p>
            <p className="mt-2 text-sm text-slate-200">{selectedProject.description ?? "Sem descricao"}</p>
            <p className="mt-2 text-xs text-slate-300">
              Cliente: {selectedProjectClientLabel} | Tipo: {projectTypeLabel(selectedProject.project_type)}
              {selectedProject.project_scopes?.length ? ` | Escopos: ${selectedProject.project_scopes.map((s) => projectTypeLabel(s as ProjectType)).join(", ")}` : ""}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {(() => {
                const ag = aggregatesByProject.get(selectedProject.id) ?? {
                  totalDocs: 0,
                  approvedDocs: 0,
                  sentDocs: 0,
                  progressApproved: 0,
                  progressSent: 0,
                  contributorCount: 0,
                };
                return (
                  <>
                    <div>
                      <p className="text-slate-300">Entrega projeto</p>
                      <p className="text-2xl font-semibold">{ag.progressApproved}%</p>
                    </div>
                    <div>
                      <p className="text-slate-300">Envio docs</p>
                      <p className="text-2xl font-semibold">{ag.progressSent}%</p>
                    </div>
                    <div>
                      <p className="text-slate-300">Entregaveis</p>
                      <p className="text-2xl font-semibold">{ag.totalDocs}</p>
                    </div>
                    <div>
                      <p className="text-slate-300">Contribuidores</p>
                      <p className="text-2xl font-semibold">{ag.contributorCount}</p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mt-6 rounded-2xl bg-white/5 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-[240px]">
                  <p className="text-xs font-semibold text-slate-200">Status do projeto</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Acompanhamento executivo de andamento do projeto.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white">
                    {selectedProject.status === "active"
                      ? "Ativo"
                      : selectedProject.status === "paused"
                        ? "Pausado"
                        : "Concluido"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum projeto selecionado.</p>
        )}
      </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Equipe do projeto</h2>
            <p className="text-xs text-slate-500">
              Organize membros e equipes antes de acompanhar as entregas.
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">
                  Membros do projeto ({selectedMembers.length})
                </summary>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Adicionar membro ao projeto</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <select
                        value={memberUserId}
                        onChange={(e) => setMemberUserId(e.target.value)}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
                      >
                        <option value="">
                          {meCompanyId
                            ? "Selecione colaborador da empresa..."
                            : "Seu perfil esta sem empresa vinculada"}
                        </option>
                        {companyUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {safeNameFromProfile(u) + ` (${u.role ?? "colaborador"})`}
                          </option>
                        ))}
                      </select>
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value as "coordenador" | "colaborador")}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="coordenador">Coordenador</option>
                        <option value="colaborador">Colaborador</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => void addMember()}
                      disabled={!selectedProjectId || saving}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                    >
                      Adicionar na equipe
                    </button>
                  </div>
                  {selectedMembers.length === 0 ? <p className="text-sm text-slate-500">Nenhum membro.</p> : null}
                  {selectedMembers.map((m) => (
                    <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <PersonChip name={personLabel(m.user_id)} subtitle={personCargo(m.user_id)} avatarUrl={personAvatar(m.user_id)} />
                        {m.member_role === "gestor" ? (
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                            Gestor (fixo)
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={memberRoleByMemberId[m.id] ?? (m.member_role as "coordenador" | "colaborador")}
                              onChange={(e) =>
                                setMemberRoleByMemberId((prev) => ({
                                  ...prev,
                                  [m.id]: e.target.value as "coordenador" | "colaborador",
                                }))
                              }
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                            >
                              <option value="coordenador">Coordenador</option>
                              <option value="colaborador">Colaborador</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => void updateMemberRole(m.id)}
                              disabled={saving}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                            >
                              Salvar funcao
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeMember(m.id)}
                              disabled={saving}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-60"
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                  Equipes do projeto ({teams.length})
                </summary>
                <div className="mt-3 space-y-3">
                <p className="text-xs text-slate-500">
                  Crie equipes nomeadas (ex: Civil, Eletrica) e distribua os membros do projeto. O coordenador e definido dentro de cada equipe.
                </p>

                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Nome da equipe (ex: Civil)"
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"
                  />
                  <button
                    type="button"
                    onClick={() => void createTeam()}
                    disabled={saving || !selectedProjectId}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 md:col-span-2"
                  >
                    Criar equipe
                  </button>
                </div>

                {teams.length ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {teams.map((t) => {
                        const rows = teamMembers.filter((x) => x.team_id === t.id);
                        const editOpen = teamEditOpenByTeamId[t.id] === true;
                        const addMemberOpen = teamAddMemberOpenByTeamId[t.id] === true;
                        return (
                          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                                <div className="text-xs text-slate-500">
                                  Coordenador: {t.coordinator_user_id ? personLabel(t.coordinator_user_id) : "Nao definido"} | {rows.length} membro(s)
                                </div>
                              </div>
                              <details className="relative">
                                <summary className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                                  Acoes
                                </summary>
                                <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAssignTeamId(t.id);
                                      setTeamAddMemberOpenByTeamId({ [t.id]: !addMemberOpen });
                                      setTeamEditOpenByTeamId({ [t.id]: false });
                                      setAssignUserId("");
                                      setMsg(`Selecione o colaborador para adicionar na equipe "${t.name}".`);
                                    }}
                                    className="mb-1 w-full rounded-md border border-slate-200 px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Adicionar membro a equipe
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTeamEditOpenByTeamId({ [t.id]: !editOpen });
                                      setTeamAddMemberOpenByTeamId({ [t.id]: false });
                                    }}
                                    className="mb-1 w-full rounded-md border border-slate-200 px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Editar equipe
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deleteTeam(t.id)}
                                    disabled={saving}
                                    className="w-full rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-left text-xs font-semibold text-rose-700 disabled:opacity-60"
                                  >
                                    Excluir equipe
                                  </button>
                                </div>
                              </details>
                            </div>
                            {editOpen ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <input
                                  value={teamNameDraftByTeamId[t.id] ?? t.name}
                                  onChange={(e) =>
                                    setTeamNameDraftByTeamId((prev) => ({ ...prev, [t.id]: e.target.value }))
                                  }
                                  className="h-9 min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                                  placeholder="Novo nome da equipe"
                                />
                                <select
                                  value={teamCoordinatorDraftByTeamId[t.id] ?? t.coordinator_user_id ?? ""}
                                  onChange={(e) =>
                                    setTeamCoordinatorDraftByTeamId((prev) => ({ ...prev, [t.id]: e.target.value }))
                                  }
                                  className="h-9 min-w-[220px] rounded-lg border border-slate-200 bg-white px-2 text-sm"
                                >
                                  <option value="">Selecione o coordenador da equipe...</option>
                                  {projectCoordinatorOptions.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => void saveTeamName(t.id)}
                                  disabled={saving}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                >
                                  Salvar
                                </button>
                              </div>
                            ) : null}
                            {addMemberOpen ? (
                              <div className="mt-2 grid gap-2 md:grid-cols-3">
                                <select
                                  value={assignUserId}
                                  onChange={(e) => setAssignUserId(e.target.value)}
                                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
                                >
                                  <option value="">Selecione colaborador da empresa / do projeto...</option>
                                  {teamCandidateOptions.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={assignProjectRole}
                                  onChange={(e) => setAssignProjectRole(e.target.value as "coordenador" | "colaborador")}
                                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                  title="Papel no projeto (se ainda nao for membro, sera criado com este papel)"
                                >
                                  <option value="colaborador">Colaborador</option>
                                  <option value="coordenador">Coordenador</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => void addMemberToTeam(t.id)}
                                  disabled={saving || !assignUserId}
                                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 md:col-span-3"
                                >
                                  Adicionar ao projeto e equipe
                                </button>
                              </div>
                            ) : null}
                            {rows.length ? (
                              <div className="mt-2 space-y-2">
                                {rows.map((r) => (
                                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                    <div className="min-w-0">
                                      <PersonChip
                                        size="sm"
                                        name={personLabel(r.user_id)}
                                        subtitle={personCargo(r.user_id)}
                                        avatarUrl={personAvatar(r.user_id)}
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {t.coordinator_user_id === r.user_id ? (
                                        <div className="flex items-center gap-2">
                                          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                            Coordenador
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => void clearTeamCoordinator(t.id, r.user_id)}
                                            disabled={saving}
                                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-60"
                                          >
                                            Remover coordenacao
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => void promoteTeamMemberToCoordinator(t.id, r.user_id)}
                                          disabled={saving}
                                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                        >
                                          Promover coordenador
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => void removeTeamMember(r)}
                                        disabled={saving}
                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-slate-500">Nenhum membro ainda.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    Nenhuma equipe criada ainda (ou SQL de equipes ainda nao foi aplicado).
                  </div>
                )}

                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                    Historico de equipe excluida/removida ({selectedDeletedTeamItems.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {selectedDeletedTeamItems.length ? (
                      selectedDeletedTeamItems.map((item) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                          <p className="font-semibold">
                            {item.event_kind === "team_deleted" ? "Equipe excluida" : "Colaborador removido"}
                          </p>
                          <p>Equipe: {item.team_name ?? "-"}</p>
                          {item.user_id ? <p>Colaborador: {personLabel(item.user_id)}</p> : null}
                          <p>Data: {new Date(item.deleted_at).toLocaleString("pt-BR")}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Nenhum historico de exclusao neste projeto.</p>
                    )}
                  </div>
                </details>
                </div>
              </details>
            </div>
          </section>

          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Lista de documentos entregaveis</h2>
          {assigneeFilter ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              <span>Filtro ativo por colaborador: <b>{assigneeLabel || assigneeFilter.slice(0, 8)}</b></span>
              <button
                type="button"
                onClick={clearAssigneeFilter}
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Limpar filtro
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Titulo do entregavel" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input type="date" value={docDueDate} onChange={(e) => setDocDueDate(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input value={docDescription} onChange={(e) => setDocDescription(e.target.value)} placeholder="Descricao" className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void addDeliverable()} disabled={!selectedProjectId || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">
              Adicionar entregavel
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  "modelo_entregaveis_gestor.csv",
                  "titulo_entregavel,previsao_entrega,descricao\nPlano de execucao,28/02/2026,Descricao do documento",
                  "text/csv;charset=utf-8"
                )
              }
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
            >
              Baixar modelo CSV
            </button>
            <label className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
              Importar CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) void importDeliverablesFromCsv(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          <div className="grid gap-2 xl:grid-cols-12">
            <input
              value={deliverableSearchInput}
              onChange={(e) => setDeliverableSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyDeliverableFilters();
                }
              }}
              placeholder="Buscar por titulo ou descricao..."
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm xl:col-span-3"
            />
            <select
              value={deliverableStatusDraft}
              onChange={(e) => setDeliverableStatusDraft(e.target.value as "all" | Deliverable["status"])}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm xl:col-span-3"
            >
              <option value="all">Todos status</option>
              <option value="pending">Pendente</option>
              <option value="in_progress">Em andamento</option>
              <option value="sent">Enviado</option>
              <option value="approved">Aprovado</option>
              <option value="approved_with_comments">Aprovado com comentarios</option>
            </select>
            <select
              value={deliverableSelectDraft}
              onChange={(e) => setDeliverableSelectDraft(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm xl:col-span-4"
            >
              <option value="">Selecione entregavel</option>
              {selectedDeliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} {d.due_date ? `- ${d.due_date}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyDeliverableFilters}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 xl:col-span-1"
            >
              Buscar
            </button>
          </div>

          <div className="space-y-3">
            {filteredSelectedDeliverables.length === 0 ? <p className="text-sm text-slate-500">Nenhum entregavel para o filtro selecionado.</p> : null}
            {filteredSelectedDeliverables.map((d) => {
              const contribs = contributions.filter((c) => c.deliverable_id === d.id);
              const assignees = deliverableAssignees.filter((a) => a.deliverable_id === d.id);
              const totalContributionHours = assignees.reduce((acc, a) => {
                const unit = a.contribution_unit ?? "hours";
                const value = Number(a.contribution_value ?? 0);
                if (unit !== "hours" || !Number.isFinite(value) || value <= 0) return acc;
                return acc + value;
              }, 0);
              const timelineAll = deliverableTimeline.filter((t) => t.deliverable_id === d.id);
              const timelineExpanded = timelineExpandedByDeliverableId[d.id] === true;
              const timeline = timelineExpanded ? timelineAll : timelineAll.slice(0, 3);
              const timelineHasMore = timelineAll.length > 3;
              const draftStatus = statusDraftByDeliverableId[d.id] ?? d.status;
              const selectedAction = deliverableActionById[d.id] ?? null;
              const latestInternalContributionEvent =
                timelineAll.find((t) =>
                  t.event_type === "contribution_added" ||
                  t.event_type === "contribution_approved" ||
                  t.event_type === "contribution_returned"
                ) ?? null;
              const pendingContributionReview = latestInternalContributionEvent?.event_type === "contribution_added";
              const overdueAwaitingInternalApproval = (() => {
                const dueDate = parseDueDate(d.due_date);
                if (!dueDate) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPastDue = dueDate <= today;
                if (!isPastDue) return false;
                return latestInternalContributionEvent?.event_type !== "contribution_approved";
              })();
              return (
                <details
                  key={d.id}
                  className={`rounded-xl border ${
                    overdueAwaitingInternalApproval
                      ? "border-2 border-rose-400 bg-rose-100/40"
                      : pendingContributionReview
                        ? "border-amber-300 bg-amber-50/40"
                        : "border-slate-200 bg-white"
                  }`}
                  open={openedDeliverableId === d.id}
                  onToggle={(e) => {
                    const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                    setOpenedDeliverableId(isOpen ? d.id : null);
                  }}
                >
                  <summary className="cursor-pointer list-none px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                        <p className="text-xs text-slate-500">
                          Status: {deliverableStatusLabel(d.status)} | Prazo: {d.due_date ? new Date(d.due_date).toLocaleDateString("pt-BR") : "-"} | Responsavel:{" "}
                          {d.assigned_to ? personLabel(d.assigned_to) : "Nao definido"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
                          Contribuicoes: {contribs.length} | Horas: {totalContributionHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h
                        </span>
                        {pendingContributionReview ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                            <BellRing size={13} />
                            Pendente validacao interna
                          </span>
                        ) : null}
                        {overdueAwaitingInternalApproval ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-800">
                            <AlertTriangle size={13} />
                            Atrasado (interno)
                          </span>
                        ) : null}
                        <details
                          className="relative"
                          onClick={(e) => e.stopPropagation()}
                          onToggle={(e) => e.stopPropagation()}
                        >
                          <summary className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                            Acoes
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow">
                            <button
                              type="button"
                              onClick={() =>
                                setDeliverableActionById((prev) => ({ ...prev, [d.id]: "status" }))
                              }
                              className="mb-1 w-full rounded-md border border-slate-200 px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Mudar status
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeliverableActionById((prev) => ({ ...prev, [d.id]: "edit" }))
                              }
                              className="mb-1 w-full rounded-md border border-slate-200 px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Editar entregavel
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeliverableActionById((prev) => ({ ...prev, [d.id]: "document" }))
                              }
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Documento
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                    {overdueAwaitingInternalApproval ? (
                      <div className="rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-800">
                        Entregavel atrasado: encaminhe e conclua a validacao interna da contribuicao.
                      </div>
                    ) : null}
                    {selectedAction === "status" ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Status do entregavel</p>
                      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                      <select
                        value={draftStatus}
                        onChange={(e) =>
                          setStatusDraftByDeliverableId((prev) => ({
                            ...prev,
                            [d.id]: e.target.value as Deliverable["status"],
                          }))
                        }
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                      >
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em andamento</option>
                        <option value="sent">Enviado</option>
                        <option value="approved">Aprovado</option>
                        <option value="approved_with_comments">Aprovado com comentarios</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void saveDraftStatus(d.id, draftStatus)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 disabled:opacity-60"
                      >
                        Salvar status
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteDeliverable(d.id)}
                        disabled={saving}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-60"
                      >
                        Excluir
                      </button>
                      </div>
                      <input
                        value={statusCommentByDeliverableId[d.id] ?? ""}
                        onChange={(e) =>
                          setStatusCommentByDeliverableId((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                        placeholder="Comentario da mudanca de status"
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                      />
                      <p className="text-xs text-slate-500">
                        Responsavel: {d.assigned_to ? personLabel(d.assigned_to) : "Nao definido"}
                      </p>
                      {d.status === "approved_with_comments" ? (
                        <p className="text-xs text-amber-700">Comentario: {d.approval_comment ?? "-"}</p>
                      ) : null}
                      {d.status === "sent" ? (
                        <button
                          type="button"
                          onClick={() =>
                            void updateDeliverableStatus(
                              d.id,
                              "approved",
                              (statusCommentByDeliverableId[d.id] ?? "").trim() || null
                            )
                          }
                          disabled={saving}
                          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Aprovar
                        </button>
                      ) : null}
                    </div>
                    ) : null}

                    {selectedAction === "document" ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Documento do entregavel</p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={docLinkByDeliverable[d.id] ?? ""}
                          onChange={(e) => setDocLinkByDeliverable((prev) => ({ ...prev, [d.id]: e.target.value }))}
                          placeholder="Link do documento"
                          className="h-9 flex-1 min-w-[220px] rounded-lg border border-slate-200 px-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => void updateDocumentLink(d.id, docLinkByDeliverable[d.id] ?? "")}
                          disabled={saving}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                        >
                          Enviar documento
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.document_path ? (
                          <button
                            type="button"
                            onClick={() => void openDeliverableFile(d.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            Abrir arquivo enviado
                          </button>
                        ) : null}
                        {d.document_url ? (
                          <a
                            href={d.document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            Abrir link informado
                          </a>
                        ) : null}
                      </div>
                    </div>
                    ) : null}

                    {selectedAction === "edit" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">Editar entregavel</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <input
                        value={editTitleByDeliverableId[d.id] ?? d.title}
                        onChange={(e) => setEditTitleByDeliverableId((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        placeholder="Titulo"
                      />
                      <input
                        type="date"
                        value={editDueByDeliverableId[d.id] ?? (d.due_date ?? "")}
                        onChange={(e) => setEditDueByDeliverableId((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                      />
                      <input
                        value={editDescByDeliverableId[d.id] ?? (d.description ?? "")}
                        onChange={(e) => setEditDescByDeliverableId((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs md:col-span-2"
                        placeholder="Descricao"
                      />
                      <button
                        type="button"
                        onClick={() => void saveDeliverableEdits(d.id)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-60 md:col-span-2"
                      >
                        Salvar alteracoes
                      </button>
                    </div>
                  </div>
                    ) : null}

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">
                        Contribuicoes ({contribs.length}) | Horas totais: {totalContributionHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {contribs.length ? (
                          contribs.map((c) => (
                            <div key={c.id} className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                {personLabel(c.user_id)} - {c.contribution_note ?? "Contribuicao registrada"}
                              </span>
                              <span className="shrink-0 text-slate-500">{formatDateTimeBR(c.created_at)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-500">Sem contribuicoes registradas.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">Linha do tempo do documento</div>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {pendingContributionReview ? (
                          <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
                            <p className="text-xs font-semibold text-amber-800">
                              Nova contribuicao aguardando aprovacao/retorno interno.
                            </p>
                            <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                              <input
                                value={contribReviewCommentByDeliverableId[d.id] ?? ""}
                                onChange={(e) =>
                                  setContribReviewCommentByDeliverableId((prev) => ({ ...prev, [d.id]: e.target.value }))
                                }
                                placeholder="Comentario para retorno (obrigatorio ao retornar)"
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => void reviewContribution(d, "approve")}
                                disabled={saving}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 disabled:opacity-60"
                              >
                                Aprovar contribuicao
                              </button>
                              <button
                                type="button"
                                onClick={() => void reviewContribution(d, "return")}
                                disabled={saving}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 disabled:opacity-60"
                              >
                                Retornar com comentarios
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {timeline.length ? (
                          timeline.map((t) => (
                            <div key={t.id}>
                              {formatDateTimeBR(t.created_at)} - {deliverableEventLabel(t.event_type)}
                              {t.status_from || t.status_to
                                ? ` (${deliverableStatusLabel(t.status_from)} -> ${deliverableStatusLabel(t.status_to)})`
                                : ""}
                              {t.comment ? ` - ${t.comment}` : ""}
                              {t.actor_user_id ? ` - ${personLabel(t.actor_user_id)}` : ""}
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-500">Sem eventos registrados.</div>
                        )}
                      </div>
                      {timelineHasMore || timelineExpanded ? (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setTimelineExpandedByDeliverableId((prev) => ({
                                ...prev,
                                [d.id]: !timelineExpanded,
                              }))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {timelineExpanded ? "Ver menos" : `Ver mais (${timelineAll.length - 3})`}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    
                </div>
              </details>
            );
            })}
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">
              Itens excluidos ({selectedDeletedDeliverables.length})
            </summary>
            <div className="mt-2 space-y-2">
              {selectedDeletedDeliverables.length ? (
                selectedDeletedDeliverables.map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                    <p className="font-semibold">{d.title ?? `Entregavel ${d.deliverable_ref_id.slice(0, 8)}`}</p>
                    <p>Excluido em: {new Date(d.deleted_at).toLocaleString("pt-BR")}</p>
                    <p>Prazo: {d.due_date ?? "-"}</p>
                    <p>Status anterior: {d.status ?? "-"}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">Nenhum item excluido neste projeto.</p>
              )}
            </div>
          </details>
        </section>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}




