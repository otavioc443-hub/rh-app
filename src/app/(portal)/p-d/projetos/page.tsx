"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";
import { PersonChip } from "@/components/people/PersonChip";

type ProjectStatus = "planning" | "active" | "paused" | "done" | "cancelled";
type MemberRole = "gestor_pd" | "coordenador_pd" | "executor";
type ActionStatus = "pending" | "in_progress" | "review" | "done" | "blocked" | "cancelled";

type P = { id: string; name: string; status: ProjectStatus; owner_user_id: string; description: string | null };
type M = { id: string; project_id: string; user_id: string; member_role: MemberRole; is_active: boolean };
type T = { id: string; project_id: string; name: string };
type TM = { id: string; project_id: string; team_id: string; user_id: string };
type A = { id: string; project_id: string; title: string; status: ActionStatus; assigned_to: string | null; due_date: string | null };
type D = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assigned_to: string | null;
  status: "pending" | "in_progress" | "sent" | "approved" | "approved_with_comments" | "blocked" | "cancelled";
  approval_comment: string | null;
  created_at: string;
};
type TL = {
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
type DeletedTeamItem = {
  id: string;
  source_module: "projects" | "pd_projects";
  event_kind: "team_deleted" | "member_removed";
  pd_project_id: string | null;
  team_name: string | null;
  user_id: string | null;
  deleted_by: string | null;
  deleted_at: string;
};
type C = { id: string; user_id: string | null; nome: string | null; email: string | null; cargo: string | null };

function person(c?: C | null) {
  if (!c) return "-";
  return (c.nome ?? "").trim() || (c.email ?? "").trim() || c.user_id || "-";
}

function memberRoleLabel(role: MemberRole) {
  if (role === "gestor_pd") return "Gestor P&D";
  if (role === "coordenador_pd") return "Coordenador P&D";
  return "Colaborador";
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
  return eventType;
}

function deliverableStatusLabel(value?: string | null) {
  if (value === "pending") return "Pendente";
  if (value === "in_progress") return "Em andamento";
  if (value === "sent") return "Enviado";
  if (value === "approved") return "Aprovado";
  if (value === "approved_with_comments") return "Aprovado com comentários";
  if (value === "blocked") return "Bloqueado";
  if (value === "cancelled") return "Cancelado";
  return value ?? "-";
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

export default function PdProjetosPage() {
  const { role, active } = useUserRole();
  const canCreateProject = active && (role === "admin" || role === "gestor");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [uid, setUid] = useState("");

  const [projects, setProjects] = useState<P[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [members, setMembers] = useState<M[]>([]);
  const [teams, setTeams] = useState<T[]>([]);
  const [teamMembers, setTeamMembers] = useState<TM[]>([]);
  const [actions, setActions] = useState<A[]>([]);
  const [deliverables, setDeliverables] = useState<D[]>([]);
  const [deliverableTimeline, setDeliverableTimeline] = useState<TL[]>([]);
  const [deletedTeamItems, setDeletedTeamItems] = useState<DeletedTeamItem[]>([]);
  const [collabs, setCollabs] = useState<C[]>([]);

  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");

  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("executor");

  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teamUserId, setTeamUserId] = useState("");

  const [actionTitle, setActionTitle] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [actionAssigned, setActionAssigned] = useState("");
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [deliverableDesc, setDeliverableDesc] = useState("");
  const [deliverableDue, setDeliverableDue] = useState("");
  const [deliverableAssigned, setDeliverableAssigned] = useState("");
  const [deliverableSearch, setDeliverableSearch] = useState("");
  const [deliverableStatusFilter, setDeliverableStatusFilter] = useState<"all" | D["status"]>("all");
  const [deliverableDateFilter, setDeliverableDateFilter] = useState("");
  const [deliverableSelectFilter, setDeliverableSelectFilter] = useState("");
  const [deliverableCommentById, setDeliverableCommentById] = useState<Record<string, string>>({});
  const [projectStatusInput, setProjectStatusInput] = useState<ProjectStatus>("active");

  const selected = useMemo(() => projects.find((x) => x.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const membersP = useMemo(() => members.filter((x) => x.project_id === selectedProjectId && x.is_active), [members, selectedProjectId]);
  const teamsP = useMemo(() => teams.filter((x) => x.project_id === selectedProjectId), [teams, selectedProjectId]);
  const teamMembersP = useMemo(() => teamMembers.filter((x) => x.project_id === selectedProjectId), [teamMembers, selectedProjectId]);
  const actionsP = useMemo(() => actions.filter((x) => x.project_id === selectedProjectId), [actions, selectedProjectId]);
  const deliverablesP = useMemo(() => deliverables.filter((x) => x.project_id === selectedProjectId), [deliverables, selectedProjectId]);
  const filteredDeliverablesP = useMemo(() => {
    const search = deliverableSearch.trim().toLowerCase();
    return deliverablesP.filter((d) => {
      const bySelect = deliverableSelectFilter ? d.id === deliverableSelectFilter : true;
      const byStatus = deliverableStatusFilter === "all" ? true : d.status === deliverableStatusFilter;
      const byDate = deliverableDateFilter ? (d.due_date ?? "") === deliverableDateFilter : true;
      const bySearch = search ? `${d.title} ${d.description ?? ""}`.toLowerCase().includes(search) : true;
      return bySelect && byStatus && byDate && bySearch;
    });
  }, [deliverablesP, deliverableSearch, deliverableSelectFilter, deliverableStatusFilter, deliverableDateFilter]);
  const timelineP = useMemo(() => deliverableTimeline.filter((x) => x.project_id === selectedProjectId), [deliverableTimeline, selectedProjectId]);
  const deletedTeamItemsP = useMemo(
    () =>
      deletedTeamItems
        .filter((x) => x.pd_project_id === selectedProjectId && x.source_module === "pd_projects")
        .sort((a, b) => +new Date(b.deleted_at) - +new Date(a.deleted_at)),
    [deletedTeamItems, selectedProjectId]
  );
  const collabByUserId = useMemo(() => {
    const map: Record<string, C> = {};
    for (const c of collabs) if (c.user_id) map[c.user_id] = c;
    return map;
  }, [collabs]);

  const myMemberRole = useMemo(() => membersP.find((x) => x.user_id === uid)?.member_role, [membersP, uid]);
  const canManageTeams = !!selected && (role === "admin" || selected.owner_user_id === uid || myMemberRole === "gestor_pd");
  const canManageMembers = canManageTeams;
  const canManageActions = canManageTeams || myMemberRole === "coordenador_pd";
  const canEditProjectStatus = !!selected && (role === "admin" || selected.owner_user_id === uid || myMemberRole === "gestor_pd");

  const approvedDeliverables = useMemo(
    () => deliverablesP.filter((d) => d.status === "approved" || d.status === "approved_with_comments").length,
    [deliverablesP]
  );
  const sentOrApprovedDeliverables = useMemo(
    () => deliverablesP.filter((d) => d.status === "sent" || d.status === "approved" || d.status === "approved_with_comments").length,
    [deliverablesP]
  );
  const progressApprovedPct = useMemo(
    () => (deliverablesP.length ? Math.round((approvedDeliverables / deliverablesP.length) * 100) : 0),
    [approvedDeliverables, deliverablesP.length]
  );
  const docsFlowPct = useMemo(
    () => (deliverablesP.length ? Math.round((sentOrApprovedDeliverables / deliverablesP.length) * 100) : 0),
    [deliverablesP.length, sentOrApprovedDeliverables]
  );
  const contributorsCount = useMemo(() => {
    const ids = new Set<string>();
    for (const d of deliverablesP) {
      if (d.assigned_to) ids.add(d.assigned_to);
    }
    return ids.size;
  }, [deliverablesP]);

  async function loadProjectsAndCollabs() {
    const [pr, co] = await Promise.all([
      supabase.from("pd_projects").select("id,name,status,owner_user_id,description").order("created_at", { ascending: false }),
      supabase.from("colaboradores").select("id,user_id,nome,email,cargo").eq("is_active", true).order("nome", { ascending: true }),
    ]);
    if (pr.error) throw new Error(pr.error.message);
    if (co.error) throw new Error(co.error.message);
    const list = (pr.data ?? []) as P[];
    setProjects(list);
    setCollabs((co.data ?? []) as C[]);
    setSelectedProjectId((prev) => (prev && list.some((x) => x.id === prev) ? prev : list[0]?.id ?? ""));
  }

  async function loadDetails(projectId: string) {
    if (!projectId) return;
    const [m, t, tm, a, d, tl, deletedRes] = await Promise.all([
      supabase.from("pd_project_members").select("id,project_id,user_id,member_role,is_active").eq("project_id", projectId),
      supabase.from("pd_project_teams").select("id,project_id,name").eq("project_id", projectId).order("created_at", { ascending: true }),
      supabase.from("pd_project_team_members").select("id,project_id,team_id,user_id").eq("project_id", projectId),
      supabase.from("pd_project_actions").select("id,project_id,title,status,assigned_to,due_date").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase
        .from("pd_project_deliverables")
        .select("id,project_id,title,description,due_date,assigned_to,status,approval_comment,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("pd_project_deliverable_timeline")
        .select("id,deliverable_id,project_id,event_type,status_from,status_to,comment,actor_user_id,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("project_team_deleted_items")
        .select("id,source_module,event_kind,pd_project_id,team_name,user_id,deleted_by,deleted_at")
        .eq("source_module", "pd_projects")
        .eq("pd_project_id", projectId)
        .order("deleted_at", { ascending: false }),
    ]);
    if (m.error) throw new Error(m.error.message);
    if (t.error) throw new Error(t.error.message);
    if (tm.error) throw new Error(tm.error.message);
    if (a.error) throw new Error(a.error.message);
    if (d.error) throw new Error(d.error.message);
    if (tl.error) throw new Error(tl.error.message);
    setMembers((m.data ?? []) as M[]);
    setTeams((t.data ?? []) as T[]);
    setTeamMembers((tm.data ?? []) as TM[]);
    setActions((a.data ?? []) as A[]);
    setDeliverables((d.data ?? []) as D[]);
    setDeliverableTimeline((tl.data ?? []) as TL[]);
    setDeletedTeamItems((deletedRes.data ?? []) as DeletedTeamItem[]);
    setTeamId((prev) => (prev && (t.data ?? []).some((x) => x.id === prev) ? prev : (t.data ?? [])[0]?.id ?? ""));
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Sessão inválida.");
      setUid(data.user.id);
      await loadProjectsAndCollabs();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar módulo P&D.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!active || !role) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, role]);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadDetails(selectedProjectId).catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Erro ao carregar projeto."));
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selected) return;
    setProjectStatusInput(selected.status);
  }, [selected]);

  async function createProject() {
    if (!canCreateProject) return setMsg("Sem permissão para criar projeto.");
    const name = projectName.trim();
    if (!name) return setMsg("Informe o nome.");
    setSaving(true);
    try {
      const { error } = await supabase.from("pd_projects").insert({ name, description: projectDesc.trim() || null, owner_user_id: uid, created_by: uid, updated_by: uid });
      if (error) throw new Error(error.message);
      setProjectName(""); setProjectDesc("");
      await loadProjectsAndCollabs();
      setMsg("Projeto criado.");
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : "Erro ao criar projeto."); }
    finally { setSaving(false); }
  }

  async function addMember() {
    if (!canManageMembers) return setMsg("Sem permissão para gerenciar membros.");
    if (!memberUserId) return setMsg("Selecione um colaborador.");
    setSaving(true);
    try {
      const { error } = await supabase.from("pd_project_members").upsert({ project_id: selectedProjectId, user_id: memberUserId, member_role: memberRole, is_active: true, added_by: uid }, { onConflict: "project_id,user_id" });
      if (error) throw new Error(error.message);
      setMemberUserId("");
      await loadDetails(selectedProjectId);
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : "Erro ao adicionar membro."); }
    finally { setSaving(false); }
  }

  async function createTeam() {
    if (!canManageTeams) return setMsg("Somente gestor de P&D cria equipes.");
    const name = teamName.trim();
    if (!name) return setMsg("Informe o nome da equipe.");
    setSaving(true);
    try {
      const { error } = await supabase.from("pd_project_teams").insert({ project_id: selectedProjectId, name, created_by: uid });
      if (error) throw new Error(error.message);
      setTeamName("");
      await loadDetails(selectedProjectId);
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : "Erro ao criar equipe."); }
    finally { setSaving(false); }
  }

  async function addTeamMember() {
    if (!canManageTeams) return setMsg("Somente gestor de P&D distribui equipe.");
    if (!teamId || !teamUserId) return setMsg("Selecione equipe e colaborador.");
    setSaving(true);
    try {
      const { error } = await supabase.from("pd_project_team_members").upsert({ project_id: selectedProjectId, team_id: teamId, user_id: teamUserId, added_by: uid }, { onConflict: "team_id,user_id" });
      if (error) throw new Error(error.message);
      setTeamUserId("");
      await loadDetails(selectedProjectId);
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : "Erro ao atribuir membro."); }
    finally { setSaving(false); }
  }

  async function removeTeamMember(teamMemberId: string) {
    if (!canManageTeams) return setMsg("Somente gestor de P&D pode remover membro da equipe.");
    if (!confirm("Remover este membro da equipe?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("pd_project_team_members").delete().eq("id", teamMemberId);
      if (error) throw new Error(error.message);
      await loadDetails(selectedProjectId);
      setMsg("Membro removido da equipe.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao remover membro da equipe.");
    } finally {
      setSaving(false);
    }
  }

  async function createAction() {
    if (!canManageActions) return setMsg("Sem permissão para criar ações.");
    const title = actionTitle.trim();
    if (!title) return setMsg("Informe o título da ação.");
    setSaving(true);
    try {
      const { error } = await supabase.from("pd_project_actions").insert({ project_id: selectedProjectId, title, due_date: actionDue || null, assigned_to: actionAssigned || null, created_by: uid, updated_by: uid });
      if (error) throw new Error(error.message);
      setActionTitle(""); setActionDue(""); setActionAssigned("");
      await loadDetails(selectedProjectId);
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : "Erro ao criar ação."); }
    finally { setSaving(false); }
  }

  async function updateActionStatus(id: string, status: ActionStatus) {
    const row = actionsP.find((x) => x.id === id);
    if (!row) return;
    if (!canManageActions && row.assigned_to !== uid) return setMsg("Sem permissão para atualizar.");
    const { error } = await supabase.from("pd_project_actions").update({ status, updated_by: uid }).eq("id", id);
    if (error) return setMsg(error.message);
    await loadDetails(selectedProjectId);
  }

  async function createDeliverable() {
    if (!canManageActions) return setMsg("Sem permissão para criar entregáveis.");
    const title = deliverableTitle.trim();
    if (!title) return setMsg("Informe o título do entregável.");
    setSaving(true);
    try {
      const insertRes = await supabase
        .from("pd_project_deliverables")
        .insert({
          project_id: selectedProjectId,
          title,
          description: deliverableDesc.trim() || null,
          due_date: deliverableDue || null,
          assigned_to: deliverableAssigned || null,
          created_by: uid,
          updated_by: uid,
        })
        .select("id")
        .single<{ id: string }>();
      if (insertRes.error) throw new Error(insertRes.error.message);

      await supabase.from("pd_project_deliverable_timeline").insert({
        deliverable_id: insertRes.data.id,
        project_id: selectedProjectId,
        event_type: "created",
        status_to: "pending",
        comment: "Entregável criado",
        actor_user_id: uid,
        actor_role: role ?? null,
      });

      setDeliverableTitle("");
      setDeliverableDesc("");
      setDeliverableDue("");
      setDeliverableAssigned("");
      await loadDetails(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar entregável.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDeliverable(id: string) {
    if (!canManageActions) return setMsg("Sem permissão para excluir entregáveis.");
    if (!confirm("Excluir este entregável? Esta ação não pode ser desfeita.")) return;
    setSaving(true);
    try {
      const del = await supabase.from("pd_project_deliverables").delete().eq("id", id);
      if (del.error) throw new Error(del.error.message);
      setDeliverableCommentById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadDetails(selectedProjectId);
      setMsg("Entregável excluído.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir entregável.");
    } finally {
      setSaving(false);
    }
  }

  async function importDeliverablesFromCsv(file: File) {
    if (!canManageActions) return setMsg("Sem permissão para importar entregáveis.");
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    setSaving(true);
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
      if (titleIdx < 0) throw new Error("CSV inválido: informe coluna de título do entregável.");

      const rows = lines
        .slice(1)
        .map((line) => parseCsvLine(line, delimiter))
        .map((cols) => ({
          title: (cols[titleIdx] ?? "").trim(),
          dueDate: dueIdx >= 0 ? normalizeCsvDate(cols[dueIdx] ?? "") : null,
          description: descIdx >= 0 ? (cols[descIdx] ?? "").trim() : "",
        }))
        .filter((r) => r.title.length > 0);

      if (!rows.length) throw new Error("Nenhuma linha válida para importação.");

      const ins = await supabase
        .from("pd_project_deliverables")
        .insert(
          rows.map((r) => ({
            project_id: selectedProjectId,
            title: r.title,
            description: r.description || null,
            due_date: r.dueDate,
            assigned_to: null,
            status: "pending" as const,
            created_by: uid,
            updated_by: uid,
          }))
        )
        .select("id");
      if (ins.error) throw new Error(ins.error.message);

      const createdIds = (ins.data ?? []) as Array<{ id: string }>;
      if (createdIds.length > 0) {
        await supabase.from("pd_project_deliverable_timeline").insert(
          createdIds.map((r) => ({
            deliverable_id: r.id,
            project_id: selectedProjectId,
            event_type: "created",
            status_to: "pending",
            comment: "Entregável criado via importação CSV.",
            actor_user_id: uid,
            actor_role: role ?? null,
          }))
        );
      }

      await loadDetails(selectedProjectId);
      setMsg(`${createdIds.length} entregável(is) importado(s) com sucesso.`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao importar CSV de entregáveis.");
    } finally {
      setSaving(false);
    }
  }

  async function updateDeliverableStatus(row: D, next: D["status"], commentInput?: string) {
    const canUpdate = canManageActions || row.assigned_to === uid;
    if (!canUpdate) return setMsg("Sem permissão para atualizar entregável.");
    setSaving(true);
    try {
      const comment = (commentInput ?? "").trim() || null;
      const patch: Record<string, unknown> = { status: next, updated_by: uid };
      if (next === "approved_with_comments") patch.approval_comment = comment;
      const up = await supabase.from("pd_project_deliverables").update(patch).eq("id", row.id);
      if (up.error) throw new Error(up.error.message);

      await supabase.from("pd_project_deliverable_timeline").insert({
        deliverable_id: row.id,
        project_id: row.project_id,
        event_type: getDeliverableStatusEventType(row.status, next),
        status_from: row.status,
        status_to: next,
        comment: next === "approved_with_comments" ? comment : null,
        actor_user_id: uid,
        actor_role: role ?? null,
      });

      setDeliverableCommentById((prev) => ({ ...prev, [row.id]: "" }));
      await loadDetails(selectedProjectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar entregável.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProjectStatus() {
    if (!selected) return;
    if (!canEditProjectStatus) return setMsg("Sem permissão para editar status do projeto.");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pd_projects")
        .update({ status: projectStatusInput, updated_by: uid })
        .eq("id", selected.id);
      if (error) throw new Error(error.message);
      await loadProjectsAndCollabs();
      await loadDetails(selected.id);
      setMsg("Status do projeto atualizado.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar status do projeto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">P&D - Projetos</h1>
            <p className="mt-1 text-sm text-slate-600">Projetos internos, equipes e direcionamento de ações para colaboradores.</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"><RefreshCcw size={16} className={loading ? "animate-spin" : ""} />Atualizar</button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-900">Novo projeto de P&D</p>
        <div className="grid gap-3 md:grid-cols-3">
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Nome do projeto" />
          <input value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" placeholder="Descrição" />
        </div>
        <button onClick={() => void createProject()} disabled={!canCreateProject || saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Criar projeto</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <p className="text-sm font-semibold text-slate-700">Projeto selecionado</p>
        <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-3 text-base">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {selected ? (
          <>
            <div className="rounded-2xl border border-slate-900 bg-slate-900 p-6 text-white">
              <h2 className="text-3xl font-semibold">{selected.name}</h2>
              <p className="mt-2 text-sm text-slate-200">{selected.description?.trim() || "Projeto interno de P&D"}</p>
              <p className="mt-2 text-xs text-slate-300">Cliente: - | Tipo: -</p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-slate-300">Entrega projeto</p>
                  <p className="text-2xl font-semibold">{progressApprovedPct}%</p>
                </div>
                <div>
                  <p className="text-slate-300">Envio docs</p>
                  <p className="text-2xl font-semibold">{docsFlowPct}%</p>
                </div>
                <div>
                  <p className="text-slate-300">Entregaveis</p>
                  <p className="text-2xl font-semibold">{deliverablesP.length}</p>
                </div>
                <div>
                  <p className="text-slate-300">Contribuidores</p>
                  <p className="text-2xl font-semibold">{contributorsCount}</p>
                </div>
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
                    <select
                      value={projectStatusInput}
                      onChange={(e) => setProjectStatusInput(e.target.value as ProjectStatus)}
                      disabled={!canEditProjectStatus || saving}
                      className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white disabled:opacity-60"
                      title={canEditProjectStatus ? "Status executivo do projeto" : "Apenas gestor P&D/dono/Admin pode editar"}
                    >
                      <option value="planning" className="text-slate-900">Planejamento</option>
                      <option value="active" className="text-slate-900">Ativo</option>
                      <option value="paused" className="text-slate-900">Pausado</option>
                      <option value="done" className="text-slate-900">Concluido</option>
                      <option value="cancelled" className="text-slate-900">Cancelado</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void saveProjectStatus()}
                      disabled={!canEditProjectStatus || saving}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Salvar status
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900">Adicionar equipe</h2>
                <div className="grid gap-3 md:grid-cols-3">
                  <select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2">
                    <option value="">Selecione colaborador da empresa...</option>
                    {collabs.filter((c) => c.user_id).map((c) => <option key={c.id} value={c.user_id ?? ""}>{person(c)}</option>)}
                  </select>
                  <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as MemberRole)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="gestor_pd">Gestor P&D</option>
                    <option value="coordenador_pd">Coordenador P&D</option>
                    <option value="executor">Executor</option>
                  </select>
                </div>
                <button onClick={() => void addMember()} disabled={!canManageMembers || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Adicionar na equipe</button>
                <p className="text-xs text-slate-500">Membros do projeto</p>
                <div className="space-y-2">
                  {membersP.map((m) => (
                    <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                      <PersonChip
                        name={person(collabByUserId[m.user_id])}
                        subtitle={`${memberRoleLabel(m.member_role)}${collabByUserId[m.user_id]?.cargo ? ` - ${collabByUserId[m.user_id]?.cargo}` : ""}`}
                      />
                    </div>
                  ))}
                  {!membersP.length ? <p className="text-sm text-slate-500">Nenhum membro.</p> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900">Equipes do projeto</h2>
                <p className="text-xs text-slate-500">Crie equipes nomeadas e distribua os membros do projeto.</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" placeholder="Nome da equipe" />
                  <button onClick={() => void createTeam()} disabled={!canManageTeams || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Criar equipe</button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Equipe</option>
                    {teamsP.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={teamUserId} onChange={(e) => setTeamUserId(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">Membro</option>
                    {membersP.map((m) => <option key={m.id} value={m.user_id}>{person(collabByUserId[m.user_id])}</option>)}
                  </select>
                </div>
                <button onClick={() => void addTeamMember()} disabled={!canManageTeams || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Adicionar na equipe</button>
                <div className="space-y-2">
                  {teamsP.map((t) => (
                    <div key={t.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                      <div className="mt-2 space-y-2">
                        {(teamMembersP.filter((x) => x.team_id === t.id)).map((x) => (
                          <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <PersonChip
                                size="sm"
                                name={person(collabByUserId[x.user_id])}
                                subtitle={collabByUserId[x.user_id]?.cargo ?? "Cargo não informado"}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => void removeTeamMember(x.id)}
                              disabled={!canManageTeams || saving}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                        {!teamMembersP.filter((x) => x.team_id === t.id).length ? <p className="text-xs text-slate-500">Nenhum membro.</p> : null}
                      </div>
                    </div>
                  ))}
                  {!teamsP.length ? <p className="text-sm text-slate-500">Nenhuma equipe criada ainda.</p> : null}
                </div>

                <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                    Histórico de equipe excluída/removida ({deletedTeamItemsP.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {deletedTeamItemsP.length ? (
                      deletedTeamItemsP.map((item) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                          <p className="font-semibold">
                            {item.event_kind === "team_deleted" ? "Equipe excluída" : "Colaborador removido"}
                          </p>
                          <p>Equipe: {item.team_name ?? "-"}</p>
                          {item.user_id ? <p>Colaborador: {person(collabByUserId[item.user_id] ?? null)}</p> : null}
                          <p>Data: {new Date(item.deleted_at).toLocaleString("pt-BR")}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Nenhum histórico de exclusão neste projeto.</p>
                    )}
                  </div>
                </details>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Ações internas</h2>
              <div className="grid gap-2 md:grid-cols-4">
                <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" placeholder="Título da ação" />
                <input type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
                <select value={actionAssigned} onChange={(e) => setActionAssigned(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="">Responsável</option>
                  {membersP.map((m) => <option key={m.id} value={m.user_id}>{person(collabByUserId[m.user_id])}</option>)}
                </select>
              </div>
              <button onClick={() => void createAction()} disabled={!canManageActions || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Criar ação</button>
              <div className="space-y-3">
                {actionsP.length ? (
                  actionsP.map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                        <select
                          value={a.status}
                          onChange={(e) => void updateActionStatus(a.id, e.target.value as ActionStatus)}
                          className="h-8 rounded-lg border border-slate-200 px-2 text-xs"
                        >
                          <option value="pending">Pendente</option>
                          <option value="in_progress">Em andamento</option>
                          <option value="review">Em revisão</option>
                          <option value="done">Concluída</option>
                          <option value="blocked">Bloqueada</option>
                          <option value="cancelled">Cancelada</option>
                        </select>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Responsável: {person(a.assigned_to ? collabByUserId[a.assigned_to] : null)} | Prazo: {a.due_date ?? "-"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Sem ações cadastradas.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Lista de documentos entregáveis</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={deliverableTitle} onChange={(e) => setDeliverableTitle(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Título do entregável" />
                <input type="date" value={deliverableDue} onChange={(e) => setDeliverableDue(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
                <input value={deliverableDesc} onChange={(e) => setDeliverableDesc(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" placeholder="Descrição" />
                <select value={deliverableAssigned} onChange={(e) => setDeliverableAssigned(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2">
                  <option value="">Responsável</option>
                  {membersP.map((m) => <option key={m.id} value={m.user_id}>{person(collabByUserId[m.user_id])}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void createDeliverable()} disabled={!canManageActions || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Adicionar entregável</button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      "modelo_entregaveis_pd.csv",
                      "titulo_entregavel,previsao_entrega,descricao\nChecklist de infraestrutura,28/02/2026,Descrição do entregável de P&D",
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

              <div className="grid gap-2 md:grid-cols-4">
                <input
                  value={deliverableSearch}
                  onChange={(e) => setDeliverableSearch(e.target.value)}
                  placeholder="Buscar por título ou descrição..."
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2"
                />
                <select
                  value={deliverableStatusFilter}
                  onChange={(e) => setDeliverableStatusFilter(e.target.value as "all" | D["status"])}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="all">Todos status</option>
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="sent">Enviado</option>
                  <option value="approved">Aprovado</option>
                  <option value="approved_with_comments">Aprovado com comentários</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="cancelled">Cancelado</option>
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
                  {deliverablesP.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} {d.due_date ? `- ${d.due_date}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {filteredDeliverablesP.length ? (
                  filteredDeliverablesP.map((d) => {
                    const itemTimeline = timelineP.filter((t) => t.deliverable_id === d.id).slice(0, 8);
                    return (
                      <div key={d.id} className="rounded-xl border border-slate-200 p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                            <p className="text-xs text-slate-500">{d.description ?? "-"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={d.status}
                              onChange={(e) =>
                                void updateDeliverableStatus(
                                  d,
                                  e.target.value as D["status"],
                                  deliverableCommentById[d.id] ?? ""
                                )
                              }
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                            >
                              <option value="pending">Pendente</option>
                              <option value="in_progress">Em andamento</option>
                              <option value="sent">Enviado</option>
                              <option value="approved">Aprovado</option>
                              <option value="approved_with_comments">Aprovado com comentários</option>
                              <option value="blocked">Bloqueado</option>
                              <option value="cancelled">Cancelado</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => void deleteDeliverable(d.id)}
                              disabled={!canManageActions || saving}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-60"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500">
                        Responsável: {person(d.assigned_to ? collabByUserId[d.assigned_to] : null)} | Prazo: {d.due_date ?? "-"}
                        </p>

                        <input
                          value={deliverableCommentById[d.id] ?? ""}
                          onChange={(e) => setDeliverableCommentById((prev) => ({ ...prev, [d.id]: e.target.value }))}
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs"
                          placeholder="Comentário para status aprovado com comentários"
                        />

                        {d.status === "approved_with_comments" ? (
                          <p className="text-xs text-amber-700">Comentário de aprovação: {d.approval_comment ?? "-"}</p>
                        ) : null}

                        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                            Linha do tempo do documento
                          </summary>
                          <div className="mt-2 space-y-1">
                            {itemTimeline.length ? (
                              itemTimeline.map((t) => (
                                <p key={t.id} className="text-xs text-slate-600">
                                  {new Date(t.created_at).toLocaleString("pt-BR")} - {deliverableEventLabel(t.event_type)}
                                  {t.status_from || t.status_to
                                    ? ` (${deliverableStatusLabel(t.status_from)} -> ${deliverableStatusLabel(t.status_to)})`
                                    : ""}
                                  {t.comment ? ` - ${t.comment}` : ""}
                                </p>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500">Sem eventos registrados.</p>
                            )}
                          </div>
                        </details>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">Sem entregáveis para o filtro selecionado.</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-slate-600">Sem projetos de P&D cadastrados.</p>
        )}
      </div>
    </div>
  );
}
