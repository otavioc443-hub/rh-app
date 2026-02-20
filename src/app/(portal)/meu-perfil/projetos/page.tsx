"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PersonChip } from "@/components/people/PersonChip";

type Project = { id: string; name: string; description: string | null; status: string | null; start_date: string | null; end_date: string | null };
type ProjectMember = { id: string; project_id: string; user_id: string; member_role: "gestor" | "coordenador" | "colaborador" };
type Deliverable = {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  assigned_to: string | null;
  status: "pending" | "in_progress" | "sent" | "approved" | "approved_with_comments";
  approval_comment: string | null;
  document_url: string | null;
  document_path: string | null;
  document_file_name: string | null;
  description: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
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

type Contribution = { id: string; deliverable_id: string; user_id: string; contribution_note: string | null; created_at: string };

type ProjectMemberDirectoryRow = {
  user_id: string;
  display_name: string;
  cargo: string | null;
  avatar_url: string | null;
};

type ProjectTeam = { id: string; project_id: string; name: string; created_at: string };
type ProjectTeamMember = { id: string; team_id: string; project_id: string; user_id: string; created_at: string };

type DeliverableFileRow = {
  id: string;
  deliverable_id: string;
  version: number;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
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
};

function statusLabel(v: string) {
  if (v === "pending") return "Pendente";
  if (v === "in_progress") return "Em andamento";
  if (v === "sent") return "Enviado";
  if (v === "approved") return "Aprovado";
  if (v === "approved_with_comments") return "Aprovado com comentarios";
  return v || "-";
}

function deliverableEventLabel(eventType: string) {
  if (eventType === "returned_for_rework") return "Retornou para ajuste";
  if (eventType === "status_changed") return "Mudanca de status";
  if (eventType === "assignment_cancelled") return "Atribuicao cancelada";
  if (eventType === "created") return "Criado";
  if (eventType === "contribution_added") return "Contribuicao registrada";
  if (eventType === "assignee_added") return "Responsavel adicionado";
  if (eventType === "assignee_removed") return "Responsavel removido";
  if (eventType === "document_uploaded") return "Documento enviado";
  if (eventType === "document_linked") return "Link de documento atualizado";
  return eventType;
}

function isEmailLike(value: string) {
  return value.includes("@");
}

function canCollaboratorEditDeliverable(status: Deliverable["status"]) {
  return status === "pending" || status === "in_progress";
}

function isLeadershipRole(role?: string | null) {
  return role === "gestor" || role === "coordenador" || role === "admin";
}

function parseReworkComment(raw?: string | null) {
  const text = (raw ?? "").trim();
  if (!text || !/Motivo:\s*Reencaminhamento/i.test(text)) return null;
  const commentMatch = /Comentario:\s*(.+)$/i.exec(text);
  return {
    reason: "Reencaminhamento",
    note: commentMatch?.[1]?.trim() ?? "",
    raw: text,
  };
}

function formatDateBR(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("pt-BR", { hour12: false });
}

export default function MeuPerfilProjetosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState<string>("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [deliverableTimeline, setDeliverableTimeline] = useState<DeliverableTimelineRow[]>([]);
  const [deliverableAssignees, setDeliverableAssignees] = useState<DeliverableAssignee[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});

  const [docLinkByDeliverable, setDocLinkByDeliverable] = useState<Record<string, string>>({});
  const [contribTextByDeliverable, setContribTextByDeliverable] = useState<Record<string, string>>({});
  const [contribHoursByDeliverable, setContribHoursByDeliverable] = useState<Record<string, string>>({});
  const [fileByDeliverable, setFileByDeliverable] = useState<Record<string, File | null>>({});
  const [filesByDeliverableId, setFilesByDeliverableId] = useState<Record<string, DeliverableFileRow[]>>({});
  const [timelineFilterByDeliverableId, setTimelineFilterByDeliverableId] = useState<
    Record<string, "all" | "leadership" | "rework">
  >({});
  const [timelineExpandedByDeliverableId, setTimelineExpandedByDeliverableId] = useState<Record<string, boolean>>({});

  const [teamOpen, setTeamOpen] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [projectMembersAll, setProjectMembersAll] = useState<ProjectMember[]>([]);
  const [directoryById, setDirectoryById] = useState<Record<string, ProjectMemberDirectoryRow>>({});
  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Nesta tela:
  // - Colaborador ve apenas projetos em que participa (query filtrada por memberships).
  // - Admin ve todos os projetos.
  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const projectDeliverablesAssignedToMe = useMemo(() => {
    const extraAssigneeDeliverableIds = new Set(
      deliverableAssignees.filter((a) => a.user_id === meId).map((a) => a.deliverable_id)
    );
    return deliverables.filter(
      (d) =>
        (d.assigned_to === meId || extraAssigneeDeliverableIds.has(d.id)) &&
        canCollaboratorEditDeliverable(d.status)
    );
  }, [deliverables, deliverableAssignees, meId]);

  const personLabel = (userId: string) => {
    const d = directoryById[userId];
    const name = (d?.display_name ?? "").trim();
    if (name && !isEmailLike(name)) return name;
    const p = profilesById[userId];
    const n = (p?.full_name ?? "").trim();
    if (n && !isEmailLike(n)) return n;
    return `Usuario ${userId.slice(0, 8)}`;
  };

  const personAvatar = (userId: string) => {
    const d = directoryById[userId];
    const url = typeof d?.avatar_url === "string" ? d.avatar_url.trim() : "";
    return url || null;
  };

  const personCargo = (userId: string) => {
    const d = directoryById[userId];
    const cargo = (d?.cargo ?? "").trim();
    return cargo || "Cargo nao informado";
  };

  const myRoleInSelectedProject = useMemo(() => {
    const row = members.find((m) => m.user_id === meId && m.project_id === selectedProjectId) ?? null;
    return row?.member_role ?? null;
  }, [members, meId, selectedProjectId]);

  const myParticipationHoursInProject = useMemo(() => {
    return deliverableAssignees
      .filter(
        (a) =>
          a.project_id === selectedProjectId &&
          a.user_id === meId &&
          (a.contribution_unit === "hours" || a.contribution_unit == null)
      )
      .reduce((sum, a) => sum + Number(a.contribution_value ?? 0), 0);
  }, [deliverableAssignees, selectedProjectId, meId]);

  const totalParticipationHoursInProject = useMemo(() => {
    return deliverableAssignees
      .filter((a) => a.project_id === selectedProjectId && (a.contribution_unit === "hours" || a.contribution_unit == null))
      .reduce((sum, a) => sum + Number(a.contribution_value ?? 0), 0);
  }, [deliverableAssignees, selectedProjectId]);

  const myParticipationPercentInProject = useMemo(() => {
    if (totalParticipationHoursInProject <= 0) return 0;
    return (myParticipationHoursInProject / totalParticipationHoursInProject) * 100;
  }, [myParticipationHoursInProject, totalParticipationHoursInProject]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Nao autenticado.");
      const userId = authData.user.id;
      setMeId(userId);

      // Role efetiva (admin ve tudo)
      let role: string | null = null;
      try {
        const { data, error } = await supabase.rpc("current_role");
        if (!error) role = data ? String(data) : null;
      } catch {
        role = null;
      }
      const admin = role === "admin";
      setIsAdmin(admin);

      // Memberships do usuario (sempre carrega, para mostrar "Seu papel" quando existir)
      const memRes = await supabase.from("project_members").select("id,project_id,user_id,member_role").eq("user_id", userId);
      if (memRes.error) throw new Error(memRes.error.message);
      const mem = (memRes.data ?? []) as ProjectMember[];
      setMembers(mem);

      const projectIds = Array.from(new Set(mem.map((m) => m.project_id)));
      if (!admin && projectIds.length === 0) {
        setProjects([]);
        setSelectedProjectId("");
        setDeliverables([]);
        setContributions([]);
        setFilesByDeliverableId({});
        setTeamOpen(false);
        setProjectMembersAll([]);
        setDirectoryById({});
        setTeams([]);
        setTeamMembers([]);
        return;
      }

      const projQ = supabase
        .from("projects")
        .select("id,name,description,status,start_date,end_date")
        .order("created_at", { ascending: false });

      const projRes = admin ? await projQ : await projQ.in("id", projectIds);
      if (projRes.error) throw new Error(projRes.error.message);

      const projs = (projRes.data ?? []) as Project[];
      setProjects(projs);
      setDeliverables([]);
      setContributions([]);

      // Seleciona apenas entre projetos em que participo.
      setSelectedProjectId((prev) => {
        const allowed = projs.map((p) => p.id);
        return prev && allowed.includes(prev) ? prev : allowed[0] ?? "";
      });

      // Fecha "Ver equipe" ao recarregar lista
      setTeamOpen(false);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar projetos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    async function loadAssignedDocs() {
      if (!meId || !selectedProjectId) {
        setDeliverables([]);
        setContributions([]);
        setFilesByDeliverableId({});
        setDeliverableTimeline([]);
        setDeliverableAssignees([]);
        setProfilesById({});
        return;
      }
      setMsg("");
      try {
        const dirRes = await supabase.rpc("project_member_directory", { p_project_id: selectedProjectId });
        if (!dirRes.error) {
          const rows = (dirRes.data ?? []) as ProjectMemberDirectoryRow[];
          const map: Record<string, ProjectMemberDirectoryRow> = {};
          for (const r of rows) map[String(r.user_id)] = r;
          setDirectoryById(map);
        } else {
          setDirectoryById({});
        }

        const [delPrimaryRes, myAssigneeRowsRes] = await Promise.all([
          supabase
            .from("project_deliverables")
            .select("id,project_id,title,due_date,assigned_to,status,approval_comment,document_url,document_path,document_file_name,description,submitted_by,submitted_at")
            .eq("project_id", selectedProjectId)
            .eq("assigned_to", meId)
            .order("created_at", { ascending: false }),
          supabase
            .from("project_deliverable_assignees")
            .select("deliverable_id")
            .eq("project_id", selectedProjectId)
            .eq("user_id", meId),
        ]);
        if (delPrimaryRes.error) throw new Error(delPrimaryRes.error.message);
        if (myAssigneeRowsRes.error) throw new Error(myAssigneeRowsRes.error.message);

        const primaryDeliverables = (delPrimaryRes.data ?? []) as Deliverable[];
        const extraDeliverableIds = Array.from(
          new Set((myAssigneeRowsRes.data ?? []).map((r) => String(r.deliverable_id)).filter(Boolean))
        );

        let extraDeliverables: Deliverable[] = [];
        if (extraDeliverableIds.length > 0) {
          const delExtraRes = await supabase
            .from("project_deliverables")
            .select("id,project_id,title,due_date,assigned_to,status,approval_comment,document_url,document_path,document_file_name,description,submitted_by,submitted_at")
            .eq("project_id", selectedProjectId)
            .in("id", extraDeliverableIds)
            .order("created_at", { ascending: false });
          if (delExtraRes.error) throw new Error(delExtraRes.error.message);
          extraDeliverables = (delExtraRes.data ?? []) as Deliverable[];
        }

        const mergedDeliverablesById = new Map<string, Deliverable>();
        for (const d of primaryDeliverables) mergedDeliverablesById.set(d.id, d);
        for (const d of extraDeliverables) mergedDeliverablesById.set(d.id, d);
        const dels = Array.from(mergedDeliverablesById.values());
        setDeliverables(dels);

        setDocLinkByDeliverable((prev) => {
          const next = { ...prev };
          for (const d of dels) next[d.id] = d.document_url ?? "";
          return next;
        });

        const deliverableIds = dels.map((d) => d.id);
        if (deliverableIds.length) {
          const fRes = await supabase
            .from("project_deliverable_files")
            .select("id,deliverable_id,version,file_name,content_type,size_bytes,uploaded_by,created_at")
            .in("deliverable_id", deliverableIds)
            .order("created_at", { ascending: false });
          if (!fRes.error) {
            const map: Record<string, DeliverableFileRow[]> = {};
            for (const row of (fRes.data ?? []) as DeliverableFileRow[]) {
              (map[row.deliverable_id] ??= []).push(row);
            }
            setFilesByDeliverableId(map);
          } else {
            setFilesByDeliverableId({});
          }

          const [cRes, timelineRes, assigneesRes] = await Promise.all([
            supabase
              .from("deliverable_contributions")
              .select("id,deliverable_id,user_id,contribution_note,created_at")
              .in("deliverable_id", deliverableIds)
              .order("created_at", { ascending: false }),
            supabase
              .from("project_deliverable_timeline")
              .select("id,deliverable_id,project_id,event_type,status_from,status_to,comment,actor_user_id,actor_role,created_at")
              .in("deliverable_id", deliverableIds)
              .order("created_at", { ascending: false }),
            supabase
              .from("project_deliverable_assignees")
              .select("id,deliverable_id,project_id,user_id,contribution_unit,contribution_value")
              .in("deliverable_id", deliverableIds),
          ]);
          if (cRes.error) throw new Error(cRes.error.message);
          if (timelineRes.error) throw new Error(timelineRes.error.message);
          if (assigneesRes.error) throw new Error(assigneesRes.error.message);
          setContributions((cRes.data ?? []) as Contribution[]);
          const nextTimeline = (timelineRes.data ?? []) as DeliverableTimelineRow[];
          const nextAssignees = (assigneesRes.data ?? []) as DeliverableAssignee[];
          setDeliverableTimeline(nextTimeline);
          setDeliverableAssignees(nextAssignees);

          const userIds = Array.from(
            new Set([
              ...dels.map((x) => x.assigned_to).filter(Boolean),
              ...nextAssignees.map((x) => x.user_id),
              ...((cRes.data ?? []) as Contribution[]).map((x) => x.user_id),
              ...nextTimeline.map((x) => x.actor_user_id).filter(Boolean),
            ].filter(Boolean) as string[])
          );
          if (userIds.length) {
            const profRes = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
            if (!profRes.error) {
              const map: Record<string, Profile> = {};
              for (const p of (profRes.data ?? []) as Profile[]) map[p.id] = p;
              setProfilesById(map);
            } else {
              setProfilesById({});
            }
          } else {
            setProfilesById({});
          }
        } else {
          setContributions([]);
          setFilesByDeliverableId({});
          setDeliverableTimeline([]);
          setDeliverableAssignees([]);
          setProfilesById({});
        }
      } catch (e: unknown) {
        setDeliverables([]);
        setContributions([]);
        setFilesByDeliverableId({});
        setDeliverableTimeline([]);
        setDeliverableAssignees([]);
        setProfilesById({});
        setMsg(e instanceof Error ? e.message : "Erro ao carregar documentos atribuidos.");
      }
    }
    void loadAssignedDocs();
  }, [meId, selectedProjectId]);

  async function loadTeamView(projectId: string) {
    if (!projectId) return;
    setTeamLoading(true);
    setMsg("");
    try {
      const [pmRes, teamsRes, tmRes, dirRes] = await Promise.all([
        supabase.from("project_members").select("id,project_id,user_id,member_role").eq("project_id", projectId),
        supabase.from("project_teams").select("id,project_id,name,created_at").eq("project_id", projectId).order("name", { ascending: true }),
        supabase.from("project_team_members").select("id,team_id,project_id,user_id,created_at").eq("project_id", projectId),
        supabase.rpc("project_member_directory", { p_project_id: projectId }),
      ]);

      if (pmRes.error) throw new Error(pmRes.error.message);
      const pms = (pmRes.data ?? []) as ProjectMember[];
      setProjectMembersAll(pms);

      // Teams podem nao existir (SQL nao aplicado): nao bloqueia
      setTeams(!teamsRes.error ? ((teamsRes.data ?? []) as ProjectTeam[]) : []);
      setTeamMembers(!tmRes.error ? ((tmRes.data ?? []) as ProjectTeamMember[]) : []);

      if (dirRes.error) throw new Error(dirRes.error.message);
      const rows = (dirRes.data ?? []) as ProjectMemberDirectoryRow[];
      const map: Record<string, ProjectMemberDirectoryRow> = {};
      for (const r of rows) map[String(r.user_id)] = r;
      setDirectoryById(map);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar equipe do projeto.");
      setProjectMembersAll([]);
      setDirectoryById({});
      setTeams([]);
      setTeamMembers([]);
    } finally {
      setTeamLoading(false);
    }
  }

  async function openDeliverableFile(deliverableId: string, version?: number) {
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;

      const qs = new URLSearchParams({ deliverable_id: deliverableId });
      if (typeof version === "number" && Number.isFinite(version) && version > 0) qs.set("version", String(version));

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

  async function uploadDeliverableFile(deliverable: Deliverable) {
    if (!canCollaboratorEditDeliverable(deliverable.status)) {
      return setMsg("Este entregavel esta bloqueado para edicao. Aguarde reencaminhamento do coordenador.");
    }
    const f = fileByDeliverable[deliverable.id] ?? null;
    if (!f) return setMsg("Selecione um arquivo para enviar.");

    setSaving(true);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;

      const fd = new FormData();
      fd.append("deliverable_id", deliverable.id);
      fd.append("file", f);

      const res = await fetch("/api/projects/deliverables/upload", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || `Erro no upload (status ${res.status})`);

      await logDeliverableEvent({
        deliverableId: deliverable.id,
        projectId: deliverable.project_id,
        eventType: "file_uploaded",
        statusFrom: deliverable.status,
        statusTo: deliverable.status,
        comment: "Arquivo anexado.",
      });
      setFileByDeliverable((prev) => ({ ...prev, [deliverable.id]: null }));
      setMsg("Arquivo anexado. Registre a contribuicao para enviar o entregavel.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar arquivo.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    // Se o usuario trocar o projeto, fecha o painel e limpa dados.
    setTeamOpen(false);
    setProjectMembersAll([]);
    setDirectoryById({});
    setTeams([]);
    setTeamMembers([]);
  }, [selectedProjectId]);

  async function saveDocument(deliverable: Deliverable) {
    if (!canCollaboratorEditDeliverable(deliverable.status)) {
      return setMsg("Este entregavel esta bloqueado para edicao. Aguarde reencaminhamento do coordenador.");
    }
    const link = (docLinkByDeliverable[deliverable.id] ?? "").trim();
    if (!link) return setMsg("Informe o link do documento.");
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
        throw new Error(json.error || "Nao foi possivel salvar o link do documento.");
      }

      await logDeliverableEvent({
        deliverableId: deliverable.id,
        projectId: deliverable.project_id,
        eventType: "document_updated",
        statusFrom: deliverable.status,
        statusTo: deliverable.status,
        comment: "Link atualizado.",
      });
      setMsg("Link salvo. Registre a contribuicao para enviar o entregavel.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar documento.");
    } finally {
      setSaving(false);
    }
  }

  async function addContribution(deliverableId: string) {
    const currentDeliverable = deliverables.find((x) => x.id === deliverableId) ?? null;
    if (currentDeliverable && !canCollaboratorEditDeliverable(currentDeliverable.status)) {
      return setMsg("Este entregavel esta bloqueado para edicao. Aguarde reencaminhamento do coordenador.");
    }
    const rawHours = (contribHoursByDeliverable[deliverableId] ?? "").replace(",", ".").trim();
    const hours = Number(rawHours);
    if (!Number.isFinite(hours) || hours <= 0) return setMsg("Informe horas validas de contribuicao.");
    const note = (contribTextByDeliverable[deliverableId] ?? "").trim();
    setSaving(true);
    setMsg("");
    try {
      const contributionText = note ? `${hours}h - ${note}` : `${hours}h`;
      const res = await supabase.from("deliverable_contributions").insert({
        deliverable_id: deliverableId,
        user_id: meId,
        contribution_note: contributionText,
      });
      if (res.error) throw new Error(res.error.message);

      // Acumula participacao em horas no registro de atribuicao do entregavel.
      const assigneeRes = await supabase
        .from("project_deliverable_assignees")
        .select("id,project_id,contribution_unit,contribution_value")
        .eq("deliverable_id", deliverableId)
        .eq("user_id", meId)
        .limit(1)
        .maybeSingle();

      if (!assigneeRes.error && assigneeRes.data?.id) {
        const nextValue = Number(assigneeRes.data.contribution_value ?? 0) + hours;
        const upd = await supabase
          .from("project_deliverable_assignees")
          .update({
            contribution_unit: "hours",
            contribution_value: nextValue,
          })
          .eq("id", assigneeRes.data.id);
        if (upd.error) throw new Error(upd.error.message);
      } else {
        const ins = await supabase.from("project_deliverable_assignees").insert({
          deliverable_id: deliverableId,
          project_id: currentDeliverable?.project_id ?? selectedProjectId,
          user_id: meId,
          contribution_unit: "hours",
          contribution_value: hours,
        });
        if (ins.error) throw new Error(ins.error.message);
      }

      const statusUpdate = await supabase
        .from("project_deliverables")
        .update({
          status: "sent",
          submitted_by: meId,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", deliverableId);
      if (statusUpdate.error) throw new Error(statusUpdate.error.message);

      await logDeliverableEvent({
        deliverableId,
        projectId: currentDeliverable?.project_id ?? selectedProjectId,
        eventType: "contribution_added",
        statusFrom: currentDeliverable?.status ?? null,
        statusTo: "sent",
        comment: contributionText,
      });
      setContribTextByDeliverable((prev) => ({ ...prev, [deliverableId]: "" }));
      setContribHoursByDeliverable((prev) => ({ ...prev, [deliverableId]: "" }));
      setMsg("Contribuicao registrada e entregavel enviado.");
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
      // nao bloqueia fluxo principal
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-6 w-[260px] animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-3 h-4 w-[420px] animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-6 h-56 w-full animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Meus projetos</h1>
          <p className="mt-1 text-sm text-slate-600">Veja projetos que voce participa e atualize documentos atribuidos a voce.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw size={16} /> Atualizar
        </button>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">{msg}</div> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Projeto
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {selectedProject ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{selectedProject.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {myRoleInSelectedProject ? `Seu papel: ${myRoleInSelectedProject}` : null}
                  {!myRoleInSelectedProject && isAdmin ? "Visao Admin (voce nao esta como membro deste projeto)" : ""}
                  {selectedProject.start_date ? ` - Inicio: ${formatDateBR(selectedProject.start_date)}` : ""}
                  {selectedProject.end_date ? ` - Fim: ${formatDateBR(selectedProject.end_date)}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !teamOpen;
                  setTeamOpen(next);
                  if (next) void loadTeamView(selectedProjectId);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {teamOpen ? "Ocultar equipe" : "Ver equipe"}
              </button>
            </div>
            <div className="mt-1 text-sm text-slate-600">{selectedProject.description ?? "Sem descricao"}</div>
          </div>
        ) : null}

        {teamOpen ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Equipe do projeto</div>
            <div className="mt-1 text-sm text-slate-600">Membros e equipes nomeadas (Civil, Eletrica, etc).</div>

            {teamLoading ? (
              <div className="mt-3 h-24 w-full animate-pulse rounded-2xl bg-slate-100" />
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">Membros do projeto</div>
                  <div className="mt-3 space-y-2">
                    {projectMembersAll.length ? (
                      projectMembersAll.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <PersonChip name={personLabel(m.user_id)} subtitle={personCargo(m.user_id)} avatarUrl={personAvatar(m.user_id)} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-700">Sem membros encontrados.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-600">Equipes do projeto</div>
                  <div className="mt-3 space-y-3">
                    {teams.length ? (
                      teams.map((t) => {
                        const rows = teamMembers.filter((x) => x.team_id === t.id);
                        return (
                          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                              <div className="text-xs text-slate-500">{rows.length} membro(s)</div>
                            </div>
                            {rows.length ? (
                              <div className="mt-2 space-y-2">
                                {rows.map((r) => {
                                  return (
                                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                      <div className="min-w-0">
                                        <PersonChip size="sm" name={personLabel(r.user_id)} subtitle={personCargo(r.user_id)} avatarUrl={personAvatar(r.user_id)} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-slate-500">Nenhum membro ainda.</div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-slate-700">
                        Nenhuma equipe criada ainda (ou SQL de equipes ainda nao foi aplicado).
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Documentos atribuidos a voce</h2>
        <p className="mt-1 text-sm text-slate-600">Atualize o link do documento e registre sua contribuicao.</p>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Participacao individual no projeto:{" "}
            <span className="font-semibold">{myParticipationHoursInProject.toFixed(1)}h</span>
            {" "}({myParticipationPercentInProject.toFixed(1)}%)
          </div>
          {projectDeliverablesAssignedToMe.length ? (
            projectDeliverablesAssignedToMe.map((d) => {
              const myContribs = contributions.filter((c) => c.deliverable_id === d.id && c.user_id === meId);
              const timelineFilter = timelineFilterByDeliverableId[d.id] ?? "all";
              const timelineAll = deliverableTimeline
                .filter((t) => t.deliverable_id === d.id)
                .filter((t) => {
                  if (timelineFilter === "leadership") return isLeadershipRole(t.actor_role);
                  if (timelineFilter === "rework") {
                    return (
                      t.event_type === "returned_for_rework" ||
                      ((t.status_from === "sent" || t.status_from === "approved" || t.status_from === "approved_with_comments") &&
                        (t.status_to === "in_progress" || t.status_to === "pending"))
                    );
                  }
                  return true;
                });
              const timelineExpanded = timelineExpandedByDeliverableId[d.id] === true;
              const timeline = timelineExpanded ? timelineAll : timelineAll.slice(0, 3);
              const timelineHasMore = timelineAll.length > 3;
              const allAssignees = Array.from(
                new Set([
                  ...(d.assigned_to ? [d.assigned_to] : []),
                  ...deliverableAssignees.filter((a) => a.deliverable_id === d.id).map((a) => a.user_id),
                ])
              );
              const latestReworkAssignment = deliverableTimeline
                .filter((t) => t.deliverable_id === d.id && t.event_type === "assignee_added")
                .map((t) => ({ row: t, parsed: parseReworkComment(t.comment) }))
                .find((x) => x.parsed);
              const canEdit = canCollaboratorEditDeliverable(d.status);
              return (
                <div key={d.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{d.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Status: <span className="font-semibold text-slate-700">{statusLabel(d.status)}</span>
                        {d.due_date ? ` - Prazo: ${formatDateBR(d.due_date)}` : ""}
                      </div>
                      {d.status === "approved_with_comments" ? (
                        <div className="mt-1 text-xs text-amber-700">Comentario da aprovacao: {d.approval_comment ?? "-"}</div>
                      ) : null}
                      {d.description ? <div className="mt-2 text-sm text-slate-600">{d.description}</div> : null}
                      {latestReworkAssignment?.parsed ? (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                          <div className="font-semibold">
                            Motivo: {latestReworkAssignment.parsed.reason}
                            {latestReworkAssignment.row.actor_user_id
                              ? ` - por ${personLabel(latestReworkAssignment.row.actor_user_id)}`
                              : ""}
                          </div>
                          <div>{latestReworkAssignment.parsed.note || latestReworkAssignment.parsed.raw}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700">Pessoas atribuidas neste entregavel</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {allAssignees.length ? (
                        allAssignees.map((uid) => (
                          <span
                            key={uid}
                            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                          >
                            {personLabel(uid)}
                            {uid === meId ? " (voce)" : ""}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">Sem outras atribuicoes.</span>
                      )}
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <input
                        value={docLinkByDeliverable[d.id] ?? ""}
                        onChange={(e) => setDocLinkByDeliverable((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        placeholder="Link do documento"
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 md:col-span-2"
                      />
                      <button
                        type="button"
                        onClick={() => void saveDocument(d)}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        <Save size={16} /> Salvar/Enviar
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Entregavel enviado. A edicao fica bloqueada ate reencaminhamento pelo coordenador.
                    </div>
                  )}

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-700">Arquivo do entregavel</div>
                      {d.document_path ? (
                        <button
                          type="button"
                          onClick={() => void openDeliverableFile(d.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Abrir arquivo atual
                        </button>
                      ) : null}
                    </div>

                    {canEdit ? (
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        <input
                          type="file"
                          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp"
                          className="block w-full text-sm md:col-span-2"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            setFileByDeliverable((prev) => ({ ...prev, [d.id]: f }));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void uploadDeliverableFile(d)}
                          disabled={saving}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Enviar arquivo
                        </button>
                      </div>
                    ) : null}

                    {(filesByDeliverableId[d.id] ?? []).length ? (
                      <div className="mt-3 space-y-2">
                        <div className="text-[11px] font-semibold text-slate-700">Ultimas versoes</div>
                        {(filesByDeliverableId[d.id] ?? []).slice(0, 3).map((f) => (
                          <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-slate-800">
                                v{f.version} - {f.file_name ?? "Arquivo"} - {formatDateTimeBR(f.created_at)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void openDeliverableFile(d.id, f.version)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Abrir
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-600">Nenhum arquivo enviado ainda.</div>
                    )}
                  </div>

                  {canEdit ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={contribHoursByDeliverable[d.id] ?? ""}
                        onChange={(e) =>
                          setContribHoursByDeliverable((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                        placeholder="Horas (ex.: 2.5)"
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      />
                      <input
                        value={contribTextByDeliverable[d.id] ?? ""}
                        onChange={(e) => setContribTextByDeliverable((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        placeholder="Descricao da contribuicao (opcional)"
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => void addContribution(d.id)}
                        disabled={saving}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Registrar contribuicao
                      </button>
                    </div>
                  ) : null}

                  {myContribs.length ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">Minhas contribuicoes recentes</div>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {myContribs.slice(0, 3).map((c) => (
                          <div key={c.id} className="flex items-start justify-between gap-3">
                            <span className="min-w-0">{c.contribution_note ?? "-"}</span>
                            <span className="shrink-0 text-slate-500">{formatDateTimeBR(c.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-700">Linha do tempo do documento</div>
                      <select
                        value={timelineFilter}
                        onChange={(e) =>
                          setTimelineFilterByDeliverableId((prev) => ({
                            ...prev,
                            [d.id]: e.target.value as "all" | "leadership" | "rework",
                          }))
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                      >
                        <option value="all">Todos</option>
                        <option value="leadership">Apenas lideranca</option>
                        <option value="rework">Apenas reencaminhamento</option>
                      </select>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {timeline.length ? (
                        timeline.map((t) => (
                          <div
                            key={t.id}
                            className={isLeadershipRole(t.actor_role) && t.comment ? "font-semibold text-indigo-700" : undefined}
                          >
                            {formatDateTimeBR(t.created_at)} - {deliverableEventLabel(t.event_type)}
                            {t.status_from || t.status_to
                              ? ` (${statusLabel(t.status_from ?? "-")} -> ${statusLabel(t.status_to ?? "-")})`
                              : ""}
                            {t.comment ? ` - ${t.comment}` : ""}
                            {isLeadershipRole(t.actor_role) && t.comment ? " [Comentario da lideranca]" : ""}
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
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Nenhum documento atribuido a voce neste projeto.
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Dica: se voce nao esta vendo um projeto, confirme se voce esta cadastrado como membro em <code>project_members</code>.
      </div>
    </div>
  );
}

