"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PersonChip } from "@/components/people/PersonChip";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "admin";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "done";
  client_id?: string | null;
  project_type?: ProjectType | null;
  project_scopes?: string[] | null;
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
type ProjectClient = { id: string; name: string; active: boolean };

type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  member_role: "gestor" | "coordenador" | "colaborador";
};

type ProjectTeam = { id: string; project_id: string; name: string; created_at: string };
type ProjectTeamMember = { id: string; team_id: string; project_id: string; user_id: string; created_at: string };

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

type Contribution = {
  id: string;
  deliverable_id: string;
  user_id: string;
  contribution_note: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ProjectMemberDirectoryRow = {
  user_id: string;
  display_name: string;
  cargo: string | null;
  avatar_url: string | null;
};

type DeliverableAssignee = {
  id: string;
  deliverable_id: string;
  project_id: string;
  user_id: string;
  contribution_unit: "hours" | "percent" | "points";
  contribution_value: number | null;
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
  actor_role: string | null;
  created_at: string;
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

function projectTypeLabel(value: ProjectType | null | undefined) {
  if (value === "hv") return "HV";
  if (value === "rmt") return "RMT";
  if (value === "basico") return "Basico";
  if (value === "estrutural") return "Estrutural";
  if (value === "civil") return "Civil";
  if (value === "eletromecanico") return "Eletromecanico";
  if (value === "eletrico") return "Eletrico";
  if (value === "hidraulico") return "Hidraulico";
  if (value === "outro") return "Outro";
  return "-";
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

export default function CoordenadorProjetosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const assigneeFilter = useMemo(() => {
    const raw = searchParams.get("assignee");
    return raw ? raw.trim() : "";
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectClients, setProjectClients] = useState<ProjectClient[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [deliverableAssignees, setDeliverableAssignees] = useState<DeliverableAssignee[]>([]);
  const [deliverableTimeline, setDeliverableTimeline] = useState<DeliverableTimelineRow[]>([]);
  const [deletedTeamItems, setDeletedTeamItems] = useState<DeletedTeamItem[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [directoryById, setDirectoryById] = useState<Record<string, ProjectMemberDirectoryRow>>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [selectedDeliverableId, setSelectedDeliverableId] = useState("");
  const [deliverableSearch, setDeliverableSearch] = useState("");
  const [deliverableStatusFilter, setDeliverableStatusFilter] = useState<"all" | Deliverable["status"]>("all");
  const [deliverableDateFilter, setDeliverableDateFilter] = useState("");
  const [deliverableSelectFilter, setDeliverableSelectFilter] = useState("");
  const [dirDescription, setDirDescription] = useState("");
  const [dirDueDate, setDirDueDate] = useState("");
  const [dirAssignedTo, setDirAssignedTo] = useState("");

  const [contribTextByDeliverable, setContribTextByDeliverable] = useState<Record<string, string>>({});
  const [docLinkByDeliverable, setDocLinkByDeliverable] = useState<Record<string, string>>({});
  const [statusCommentByDeliverableId, setStatusCommentByDeliverableId] = useState<Record<string, string>>({});
  const [newAssigneeByDeliverableId, setNewAssigneeByDeliverableId] = useState<Record<string, string>>({});

  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");

  const [editOpenByDeliverableId, setEditOpenByDeliverableId] = useState<Record<string, boolean>>({});
  const [editTitleByDeliverableId, setEditTitleByDeliverableId] = useState<Record<string, string>>({});
  const [editDescByDeliverableId, setEditDescByDeliverableId] = useState<Record<string, string>>({});
  const [editDueByDeliverableId, setEditDueByDeliverableId] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Nao autenticado.");
      const userId = authData.user.id;
      setMeId(userId);

      // Admin deve enxergar tudo (nao depender de membership).
      let effectiveRole: Role | null = null;
      try {
        const { data: cr, error: crErr } = await supabase.rpc("current_role");
        if (!crErr) effectiveRole = (cr as Role) ?? null;
      } catch {
        // ignore
      }
      const isAdmin = effectiveRole === "admin";

      let projectIds: string[] = [];
      if (isAdmin) {
        const allRes = await supabase.from("projects").select("id,name,description,status,client_id,project_type,project_scopes").order("name", { ascending: true });
        if (allRes.error) throw new Error(allRes.error.message);
        projectIds = ((allRes.data ?? []) as Project[]).map((p) => p.id);
      } else {
        const myMemberRes = await supabase
          .from("project_members")
          .select("id,project_id,user_id,member_role")
          .eq("user_id", userId);
        if (myMemberRes.error) throw new Error(myMemberRes.error.message);

        const myMemberships = (myMemberRes.data ?? []) as ProjectMember[];
        projectIds = Array.from(new Set(myMemberships.map((m) => m.project_id)));
      }
      if (projectIds.length === 0) {
        setProjects([]);
        setProjectClients([]);
        setMembers([]);
        setDeliverables([]);
        setContributions([]);
        setDeliverableAssignees([]);
        setDeliverableTimeline([]);
        setProfilesById({});
        setSelectedProjectId("");
        return;
      }

      const [projRes, memRes, delRes] = await Promise.all([
        supabase.from("projects").select("id,name,description,status,client_id,project_type,project_scopes").in("id", projectIds),
        supabase.from("project_members").select("id,project_id,user_id,member_role").in("project_id", projectIds),
        supabase
          .from("project_deliverables")
          .select("id,project_id,title,description,due_date,assigned_to,status,approval_comment,document_url,document_path,document_file_name,submitted_by")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false }),
      ]);
      if (projRes.error) throw new Error(projRes.error.message);
      if (memRes.error) throw new Error(memRes.error.message);
      if (delRes.error) throw new Error(delRes.error.message);

      const nextProjects = (projRes.data ?? []) as Project[];
      const nextMembers = (memRes.data ?? []) as ProjectMember[];
      const nextDeliverables = (delRes.data ?? []) as Deliverable[];
      setProjects(nextProjects);
      setMembers(nextMembers);
      setDeliverables(nextDeliverables);
      setSelectedProjectId((prev) => (prev && nextProjects.some((p) => p.id === prev) ? prev : nextProjects[0]?.id ?? ""));
      setDocLinkByDeliverable(
        Object.fromEntries(nextDeliverables.map((d) => [d.id, d.document_url ?? ""]))
      );

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
      setStatusCommentByDeliverableId((prev) => {
        const next = { ...prev };
        for (const d of nextDeliverables) if (typeof next[d.id] !== "string") next[d.id] = d.approval_comment ?? "";
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
            .select("id,deliverable_id,project_id,event_type,status_from,status_to,comment,actor_user_id,actor_role,created_at")
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
          ...nextMembers.map((m) => m.user_id),
          ...nextDeliverables.map((d) => d.assigned_to).filter(Boolean),
          ...nextDeliverables.map((d) => d.submitted_by).filter(Boolean),
          ...nextContributions.map((c) => c.user_id),
          ...nextAssignees.map((a) => a.user_id),
          ...nextTimeline.map((t) => t.actor_user_id).filter(Boolean),
        ].filter(Boolean) as string[])
      );
      if (userIds.length > 0) {
        const profRes = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
        if (!profRes.error) {
          const map: Record<string, Profile> = {};
          for (const p of (profRes.data ?? []) as Profile[]) map[p.id] = p;
          setProfilesById(map);
        }
      } else {
        setProfilesById({});
      }

      const cRes = await supabase.from("project_clients").select("id,name,active").eq("active", true).order("name", { ascending: true });
      if (!cRes.error) setProjectClients((cRes.data ?? []) as ProjectClient[]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar projetos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function loadTeams(projectId: string) {
    if (!projectId) {
      setTeams([]);
      setTeamMembers([]);
      setDeletedTeamItems([]);
      return;
    }
    try {
      const [tRes, tmRes, deletedRes] = await Promise.all([
        supabase.from("project_teams").select("id,project_id,name,created_at").eq("project_id", projectId).order("name", { ascending: true }),
        supabase.from("project_team_members").select("id,team_id,project_id,user_id,created_at").eq("project_id", projectId),
        supabase
          .from("project_team_deleted_items")
          .select("id,source_module,event_kind,project_id,team_name,user_id,deleted_by,deleted_at")
          .eq("source_module", "projects")
          .eq("project_id", projectId)
          .order("deleted_at", { ascending: false }),
      ]);
      if (tRes.error) throw tRes.error;
      if (tmRes.error) throw tmRes.error;
      setTeams((tRes.data ?? []) as ProjectTeam[]);
      setTeamMembers((tmRes.data ?? []) as ProjectTeamMember[]);
      setDeletedTeamItems((deletedRes.data ?? []) as DeletedTeamItem[]);
      setAssignTeamId((prev) => (prev && (tRes.data ?? []).some((t) => t.id === prev) ? prev : String((tRes.data ?? [])[0]?.id ?? "")));
    } catch {
      setTeams([]);
      setTeamMembers([]);
      setDeletedTeamItems([]);
    }
  }

  useEffect(() => {
    void loadTeams(selectedProjectId);
  }, [selectedProjectId]);

  const selectedDeletedTeamItems = useMemo(
    () =>
      deletedTeamItems
        .filter((d) => d.project_id === selectedProjectId && d.source_module === "projects")
        .sort((a, b) => +new Date(b.deleted_at) - +new Date(a.deleted_at)),
    [deletedTeamItems, selectedProjectId]
  );

  useEffect(() => {
    void loadMemberDirectory(selectedProjectId);
  }, [selectedProjectId]);

  const projectMembers = useMemo(
    () => members.filter((m) => m.project_id === selectedProjectId),
    [members, selectedProjectId]
  );

  const projectDeliverables = useMemo(
    () => deliverables.filter((d) => d.project_id === selectedProjectId),
    [deliverables, selectedProjectId]
  );
  const filteredProjectDeliverables = useMemo(() => {
    const search = deliverableSearch.trim().toLowerCase();
    return projectDeliverables.filter((d) => {
      const hasExtraAssignee = assigneeFilter
        ? deliverableAssignees.some((a) => a.deliverable_id === d.id && a.user_id === assigneeFilter)
        : false;
      const byAssignee = assigneeFilter ? (d.assigned_to === assigneeFilter || hasExtraAssignee) : true;
      const bySelect = deliverableSelectFilter ? d.id === deliverableSelectFilter : true;
      const byStatus = deliverableStatusFilter === "all" ? true : d.status === deliverableStatusFilter;
      const byDate = deliverableDateFilter ? (d.due_date ?? "") === deliverableDateFilter : true;
      const bySearch = search
        ? `${d.title} ${d.description ?? ""}`.toLowerCase().includes(search)
        : true;
      return byAssignee && bySelect && byStatus && byDate && bySearch;
    });
  }, [projectDeliverables, deliverableAssignees, assigneeFilter, deliverableSearch, deliverableSelectFilter, deliverableStatusFilter, deliverableDateFilter]);

  // Ao trocar de projeto (ou recarregar), garanta que o select aponte para um
  // entregavel valido do projeto atual, para evitar "select vazio".
  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedDeliverableId("");
      return;
    }
    if (selectedDeliverableId && projectDeliverables.some((d) => d.id === selectedDeliverableId)) return;
    setSelectedDeliverableId(projectDeliverables[0]?.id ?? "");
  }, [selectedProjectId, projectDeliverables, selectedDeliverableId]);

  const selectedDeliverable = useMemo(
    () => projectDeliverables.find((d) => d.id === selectedDeliverableId) ?? null,
    [projectDeliverables, selectedDeliverableId]
  );

  useEffect(() => {
    if (!selectedDeliverable) {
      setDirDescription("");
      setDirDueDate("");
      setDirAssignedTo("");
      return;
    }
    setDirDescription(selectedDeliverable.description ?? "");
    setDirDueDate(selectedDeliverable.due_date ?? "");
    setDirAssignedTo(selectedDeliverable.assigned_to ?? "");
  }, [selectedDeliverable]);

  const progress = useMemo(() => {
    const total = projectDeliverables.length;
    const sent = projectDeliverables.filter(
      (d) => d.status === "sent" || d.status === "approved" || d.status === "approved_with_comments"
    ).length;
    const approved = projectDeliverables.filter(
      (d) => d.status === "approved" || d.status === "approved_with_comments"
    ).length;
    return {
      total,
      sentPct: total ? Math.round((sent / total) * 100) : 0,
      approvedPct: total ? Math.round((approved / total) * 100) : 0,
    };
  }, [projectDeliverables]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of projectClients) map[c.id] = c.name;
    return map;
  }, [projectClients]);

  const personLabel = (userId: string) => {
    const d = directoryById[userId];
    const name = (d?.display_name ?? "").trim();
    if (name && !isEmailLike(name)) return name;
    const p = profilesById[userId];
    const n = (p?.full_name ?? "").trim();
    if (n && !isEmailLike(n)) return n;
    return `Colaborador ${userId.slice(0, 8)}`;
  };

  const personCargo = (userId: string) => {
    const d = directoryById[userId];
    const cargo = (d?.cargo ?? "").trim();
    return cargo || "Cargo nao informado";
  };

  const personAvatar = (userId: string) => {
    const d = directoryById[userId];
    const url = typeof d?.avatar_url === "string" ? d.avatar_url.trim() : "";
    return url || null;
  };

  function clearAssigneeFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("assignee");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
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

  async function directDeliverable() {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    if (!selectedDeliverableId) return setMsg("Selecione um documento do projeto.");
    if (!dirAssignedTo) return setMsg("Selecione um responsavel.");
    setSaving(true);
    setMsg("");
    try {
      const previous = selectedDeliverable;
      const nextStatus =
        selectedDeliverable?.status === "pending" ? "in_progress" : selectedDeliverable?.status;
      const res = await supabase
        .from("project_deliverables")
        .update({
          // Coordenador direciona um documento existente do projeto para alguem da equipe.
          assigned_to: dirAssignedTo,
          due_date: dirDueDate || null,
          description: dirDescription.trim() || null,
          status: nextStatus,
        })
        .eq("id", selectedDeliverableId);
      if (res.error) throw new Error(res.error.message);
      await logDeliverableEvent({
        deliverableId: selectedDeliverableId,
        projectId: selectedProjectId,
        eventType: "directed",
        statusFrom: previous?.status ?? null,
        statusTo: nextStatus ?? null,
        comment: `Responsavel: ${personLabel(dirAssignedTo)}`,
      });

      setMsg("Documento direcionado para a equipe.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao direcionar documento.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDocument(deliverable: Deliverable) {
    const link = (docLinkByDeliverable[deliverable.id] ?? "").trim();
    setSaving(true);
    setMsg("");
    try {
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
          deliverable_id: deliverable.id,
          document_url: link,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Nao foi possivel atualizar o documento.");
      }

      await logDeliverableEvent({
        deliverableId: deliverable.id,
        projectId: deliverable.project_id,
        eventType: "document_updated",
        statusFrom: deliverable.status,
        statusTo: link ? "sent" : deliverable.status,
        comment: link ? "Documento enviado/atualizado." : "Documento limpo.",
      });
      setMsg("Documento enviado/atualizado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar documento.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(deliverableId: string, status: Deliverable["status"]) {
    setSaving(true);
    setMsg("");
    try {
      const current = deliverables.find((x) => x.id === deliverableId) ?? null;
      const currentStatus = current?.status ?? null;
      const needsAutoSentStep =
        currentStatus === "in_progress" && (status === "approved" || status === "approved_with_comments");
      const approvalComment =
        status === "approved_with_comments"
          ? (statusCommentByDeliverableId[deliverableId] ?? "").trim() || null
          : current?.approval_comment ?? null;
      if (needsAutoSentStep) {
        const sentRes = await supabase.from("project_deliverables").update({ status: "sent" }).eq("id", deliverableId);
        if (sentRes.error) throw new Error(sentRes.error.message);
        await logDeliverableEvent({
          deliverableId,
          projectId: current?.project_id ?? selectedProjectId,
          eventType: getDeliverableStatusEventType(currentStatus, "sent"),
          statusFrom: currentStatus,
          statusTo: "sent",
        });
      }
      const fromStatus = needsAutoSentStep ? "sent" : currentStatus;
      const res = await supabase
        .from("project_deliverables")
        .update({ status, approval_comment: approvalComment })
        .eq("id", deliverableId);
      if (res.error) throw new Error(res.error.message);
      await logDeliverableEvent({
        deliverableId,
        projectId: current?.project_id ?? selectedProjectId,
        eventType: getDeliverableStatusEventType(fromStatus, status),
        statusFrom: fromStatus,
        statusTo: status,
        comment: status === "approved_with_comments" ? approvalComment : null,
      });
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar status.");
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
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar entregavel.");
    } finally {
      setSaving(false);
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

  async function addMemberToTeam() {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    if (!assignTeamId) return setMsg("Selecione uma equipe.");
    if (!assignUserId) return setMsg("Selecione um membro do projeto.");
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_team_members").insert({
        team_id: assignTeamId,
        project_id: selectedProjectId,
        user_id: assignUserId,
        added_by: meId || null,
      });
      if (res.error) throw new Error(res.error.message);
      setAssignUserId("");
      setMsg("Membro adicionado na equipe.");
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

  async function addContribution(deliverableId: string) {
    const note = (contribTextByDeliverable[deliverableId] ?? "").trim();
    if (!note) return setMsg("Informe a contribuicao.");
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("deliverable_contributions").insert({
        deliverable_id: deliverableId,
        user_id: meId,
        contribution_note: note,
      });
      if (res.error) throw new Error(res.error.message);
      const current = deliverables.find((x) => x.id === deliverableId) ?? null;
      await logDeliverableEvent({
        deliverableId,
        projectId: current?.project_id ?? selectedProjectId,
        eventType: "contribution_added",
        comment: note,
      });
      setContribTextByDeliverable((prev) => ({ ...prev, [deliverableId]: "" }));
      setMsg("Contribuicao registrada.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar contribuicao.");
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

  async function addAssignee(deliverable: Deliverable) {
    const userId = (newAssigneeByDeliverableId[deliverable.id] ?? "").trim();
    if (!userId) return setMsg("Selecione uma pessoa para atribuir.");
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_deliverable_assignees").insert({
        deliverable_id: deliverable.id,
        project_id: deliverable.project_id,
        user_id: userId,
        contribution_unit: "hours",
        contribution_value: null,
        created_by: meId || null,
      });
      if (res.error) throw new Error(res.error.message);
      await logDeliverableEvent({
        deliverableId: deliverable.id,
        projectId: deliverable.project_id,
        eventType: "assignee_added",
        comment: personLabel(userId),
      });
      setNewAssigneeByDeliverableId((prev) => ({ ...prev, [deliverable.id]: "" }));
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao adicionar pessoa no documento.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignee(deliverable: Deliverable, assignee: DeliverableAssignee) {
    if (!confirm("Remover esta pessoa do documento?")) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_deliverable_assignees").delete().eq("id", assignee.id);
      if (res.error) throw new Error(res.error.message);
      await logDeliverableEvent({
        deliverableId: deliverable.id,
        projectId: deliverable.project_id,
        eventType: "assignee_removed",
        comment: personLabel(assignee.user_id),
      });
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao remover pessoa do documento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Projetos que participo</h1>
            <p className="mt-1 text-sm text-slate-600">
              Minha equipe, direcionamento de documentos e percentual de entrega.
            </p>
          </div>
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
              Cliente: {selectedProject.client_id ? (clientNameById[selectedProject.client_id] ?? selectedProject.client_id) : "-"} | Tipo: {projectTypeLabel(selectedProject.project_type)}
              {selectedProject.project_scopes?.length
                ? ` | Escopos: ${selectedProject.project_scopes.map((s) => projectTypeLabel(s as ProjectType)).join(", ")}`
                : ""}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-slate-300">Total docs</p>
                <p className="text-2xl font-semibold">{progress.total}</p>
              </div>
              <div>
                <p className="text-slate-300">Percentual enviado</p>
                <p className="text-2xl font-semibold">{progress.sentPct}%</p>
              </div>
              <div>
                <p className="text-slate-300">Percentual aprovado</p>
                <p className="text-2xl font-semibold">{progress.approvedPct}%</p>
              </div>
              <div>
                <p className="text-slate-300">Membros</p>
                <p className="text-2xl font-semibold">{projectMembers.length}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum projeto selecionado.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Minha equipe</h2>
          {projectMembers.length === 0 ? <p className="text-sm text-slate-500">Sem equipe nesse projeto.</p> : null}
          {projectMembers.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <PersonChip name={personLabel(m.user_id)} subtitle={personCargo(m.user_id)} avatarUrl={personAvatar(m.user_id)} />
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Direcionar documentos</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={selectedDeliverableId}
              onChange={(e) => setSelectedDeliverableId(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">{projectDeliverables.length ? "Selecione um documento do projeto..." : "Nenhum documento cadastrado no projeto"}</option>
              {projectDeliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dirDueDate}
              onChange={(e) => setDirDueDate(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            />

            <input
              value={dirDescription}
              onChange={(e) => setDirDescription(e.target.value)}
              placeholder="Descricao (opcional)"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"
            />

            <select
              value={dirAssignedTo}
              onChange={(e) => setDirAssignedTo(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
            >
              <option value="">Selecione o responsavel...</option>
              {projectMembers.map((m) => (
                <option key={m.id} value={m.user_id}>
                  {personLabel(m.user_id)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void directDeliverable()}
            disabled={saving || !selectedProjectId || !selectedDeliverableId || projectDeliverables.length === 0}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            Direcionar para equipe
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Equipes do projeto</h2>
        <p className="text-xs text-slate-500">Adicione membros em equipes ja criadas pelo gestor.</p>

        {teams.length ? (
          <div className="grid gap-2 md:grid-cols-3">
            <select
              value={assignTeamId}
              onChange={(e) => setAssignTeamId(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Selecione um membro...</option>
              {projectMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {personLabel(m.user_id)} ({m.member_role})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void addMemberToTeam()}
              disabled={saving || !assignTeamId || !assignUserId}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 md:col-span-3"
            >
              Adicionar membro na equipe
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Nenhuma equipe criada ainda (ou SQL de equipes ainda nao foi aplicado).
          </div>
        )}

        {teams.length ? (
          <div className="space-y-2">
            {teams.map((t) => {
              const rows = teamMembers.filter((x) => x.team_id === t.id);
              return (
                <div key={t.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">{rows.length} membro(s)</div>
                  </div>
                  {rows.length ? (
                    <div className="mt-2 space-y-2">
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="min-w-0">
                        <PersonChip size="sm" name={personLabel(r.user_id)} subtitle={personCargo(r.user_id)} avatarUrl={personAvatar(r.user_id)} />
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeTeamMember(r)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                          >
                            Remover
                          </button>
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
        ) : null}

        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">
            Historico de equipe excluida/removida ({selectedDeletedTeamItems.length})
          </summary>
          <div className="mt-2 space-y-2">
            {selectedDeletedTeamItems.length ? (
              selectedDeletedTeamItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Campo de envio de documentos</h2>
        {assigneeFilter ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
            <span>Filtro ativo por colaborador: <b>{personLabel(assigneeFilter)}</b></span>
            <button
              type="button"
              onClick={clearAssigneeFilter}
              className="rounded-lg border border-indigo-200 bg-white px-2 py-1 font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Limpar filtro
            </button>
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-4">
          <input
            value={deliverableSearch}
            onChange={(e) => setDeliverableSearch(e.target.value)}
            placeholder="Buscar por titulo ou descricao..."
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2"
          />
          <select
            value={deliverableStatusFilter}
            onChange={(e) => setDeliverableStatusFilter(e.target.value as "all" | Deliverable["status"])}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">Todos status</option>
            <option value="pending">Pendente</option>
            <option value="in_progress">Em andamento</option>
            <option value="sent">Enviado</option>
            <option value="approved">Aprovado</option>
            <option value="approved_with_comments">Aprovado com comentarios</option>
          </select>
          <input
            type="date"
            value={deliverableDateFilter}
            onChange={(e) => setDeliverableDateFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          />
          <select
            value={deliverableSelectFilter}
            onChange={(e) => setDeliverableSelectFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm md:col-span-4"
          >
            <option value="">Selecionar item (lista suspensa)</option>
            {projectDeliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} {d.due_date ? `- ${d.due_date}` : ""}
              </option>
            ))}
          </select>
        </div>
        {filteredProjectDeliverables.length === 0 ? <p className="text-sm text-slate-500">Sem documentos para o filtro selecionado.</p> : null}
        {filteredProjectDeliverables.map((d) => {
          const list = contributions.filter((c) => c.deliverable_id === d.id);
          const assignees = deliverableAssignees.filter((a) => a.deliverable_id === d.id);
          const timeline = deliverableTimeline.filter((t) => t.deliverable_id === d.id).slice(0, 8);
          return (
            <div key={d.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                <select value={d.status} onChange={(e) => void setStatus(d.id, e.target.value as Deliverable["status"])} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="sent">Enviado</option>
                  <option value="approved">Aprovado</option>
                  <option value="approved_with_comments">Aprovado com comentarios</option>
                </select>
              </div>
              <p className="text-xs text-slate-500">
                Responsavel: {d.assigned_to ? personLabel(d.assigned_to) : "Nao definido"}
              </p>
              {d.status === "approved_with_comments" ? (
                <p className="text-xs text-amber-700">Comentario: {d.approval_comment ?? "-"}</p>
              ) : null}
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

              {d.status === "sent" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void setStatus(d.id, "approved")}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Aprovar
                  </button>
                  <input
                    value={statusCommentByDeliverableId[d.id] ?? ""}
                    onChange={(e) => setStatusCommentByDeliverableId((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    placeholder="Comentario da aprovacao"
                    className="h-9 min-w-[220px] rounded-lg border border-slate-200 px-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void setStatus(d.id, "approved_with_comments")}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-60"
                  >
                    Aprovar com comentarios
                  </button>
                </div>
              ) : null}

              <details
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                open={!!editOpenByDeliverableId[d.id]}
                onToggle={(e) => {
                  const open = (e.currentTarget as HTMLDetailsElement).open;
                  setEditOpenByDeliverableId((prev) => ({ ...prev, [d.id]: open }));
                }}
              >
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">Editar entregavel</summary>
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
              </details>

              <div className="flex flex-wrap gap-2">
                <input
                  value={docLinkByDeliverable[d.id] ?? ""}
                  onChange={(e) => setDocLinkByDeliverable((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  placeholder="Link do documento"
                  className="h-9 flex-1 min-w-[240px] rounded-lg border border-slate-200 px-2 text-xs"
                />
                <button type="button" onClick={() => void saveDocument(d)} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800">
                  Enviar documento
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  value={contribTextByDeliverable[d.id] ?? ""}
                  onChange={(e) => setContribTextByDeliverable((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  placeholder="Registrar contribuicao nesse documento"
                  className="h-9 flex-1 min-w-[240px] rounded-lg border border-slate-200 px-2 text-xs"
                />
                <button type="button" onClick={() => void addContribution(d.id)} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800">
                  Registrar
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-700">Pessoas atribuidas</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={newAssigneeByDeliverableId[d.id] ?? ""}
                    onChange={(e) => setNewAssigneeByDeliverableId((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="h-9 min-w-[220px] rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="">Selecionar pessoa...</option>
                    {projectMembers.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {personLabel(m.user_id)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void addAssignee(d)}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    Atribuir
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {assignees.length ? (
                    assignees.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                        <span className="text-xs text-slate-700">{personLabel(a.user_id)}</span>
                        <button
                          type="button"
                          onClick={() => void removeAssignee(d, a)}
                          disabled={saving}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                        >
                          Remover
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">Nenhuma pessoa adicional atribuida.</div>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-500">Contribuidores ({list.length})</p>
              {list.map((c) => (
                <p key={c.id} className="text-xs text-slate-600">
                  {personLabel(c.user_id)} - {c.contribution_note ?? "Contribuicao"}
                </p>
              ))}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Linha do tempo do documento</p>
                <div className="mt-2 space-y-1">
                  {timeline.length ? (
                    timeline.map((t) => (
                      <p key={t.id} className="text-xs text-slate-600">
                        {new Date(t.created_at).toLocaleString()} - {deliverableEventLabel(t.event_type)}
                        {t.status_from || t.status_to
                          ? ` (${deliverableStatusLabel(t.status_from)} -> ${deliverableStatusLabel(t.status_to)})`
                          : ""}
                        {t.comment ? ` - ${t.comment}` : ""}
                        {t.actor_user_id ? ` - ${personLabel(t.actor_user_id)}` : ""}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">Sem eventos registrados.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}


