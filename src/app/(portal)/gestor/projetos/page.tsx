"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
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

type ProjectTeam = { id: string; project_id: string; name: string; created_at: string };
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
  status: "pending" | "in_progress" | "sent" | "approved";
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

export default function GestorProjetosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState<string>("");
  const [meCompanyId, setMeCompanyId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ProjectClient[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [directoryById, setDirectoryById] = useState<Record<string, ProjectMemberDirectoryRow>>({});

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"coordenador" | "colaborador">("coordenador");
  const [companyUsers, setCompanyUsers] = useState<Profile[]>([]);

  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docDueDate, setDocDueDate] = useState("");

  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignProjectRole, setAssignProjectRole] = useState<"coordenador" | "colaborador">("colaborador");

  const [editOpenByDeliverableId, setEditOpenByDeliverableId] = useState<Record<string, boolean>>({});
  const [editTitleByDeliverableId, setEditTitleByDeliverableId] = useState<Record<string, string>>({});
  const [editDescByDeliverableId, setEditDescByDeliverableId] = useState<Record<string, string>>({});
  const [editDueByDeliverableId, setEditDueByDeliverableId] = useState<Record<string, string>>({});

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
    return cargo || "Cargo não informado";
  }, [directoryById]);

  const personAvatar = useCallback((userId: string) => {
    const d = directoryById[userId];
    const url = typeof d?.avatar_url === "string" ? d.avatar_url.trim() : "";
    return url || null;
  }, [directoryById]);

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
        setProfilesById({});
        setSelectedProjectId("");
        return;
      }

      const [projRes, memRes, delRes] = await Promise.all([
        supabase.from("projects").select("id,name,description,status,start_date,end_date,budget_total,owner_user_id,client_id,project_type,project_scopes,created_at").in("id", ids).order("created_at", { ascending: false }),
        supabase.from("project_members").select("id,project_id,user_id,member_role").in("project_id", ids),
        supabase.from("project_deliverables").select("id,project_id,title,description,due_date,assigned_to,status,document_url,document_path,document_file_name,submitted_by").in("project_id", ids).order("created_at", { ascending: false }),
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
      if (nextDeliverables.length > 0) {
        const deliverableIds = nextDeliverables.map((d) => d.id);
        const contribRes = await supabase
          .from("deliverable_contributions")
          .select("id,deliverable_id,user_id,contribution_note,created_at")
          .in("deliverable_id", deliverableIds)
          .order("created_at", { ascending: false });
        if (contribRes.error) throw new Error(contribRes.error.message);
        nextContributions = (contribRes.data ?? []) as Contribution[];
        setContributions(nextContributions);
      } else {
        setContributions([]);
      }

      const userIds = Array.from(
        new Set([
          ...nextProjects.map((p) => p.owner_user_id),
          ...nextMembers.map((m) => m.user_id),
          ...nextDeliverables.map((d) => d.assigned_to).filter(Boolean),
          ...nextDeliverables.map((d) => d.submitted_by).filter(Boolean),
          ...nextContributions.map((c) => c.user_id),
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

  async function loadTeams(projectId: string) {
    if (!projectId) {
      setTeams([]);
      setTeamMembers([]);
      return;
    }
    try {
      const [tRes, tmRes] = await Promise.all([
        supabase.from("project_teams").select("id,project_id,name,created_at").eq("project_id", projectId).order("name", { ascending: true }),
        supabase.from("project_team_members").select("id,team_id,project_id,user_id,created_at").eq("project_id", projectId),
      ]);
      if (tRes.error) throw tRes.error;
      if (tmRes.error) throw tmRes.error;
      setTeams((tRes.data ?? []) as ProjectTeam[]);
      setTeamMembers((tmRes.data ?? []) as ProjectTeamMember[]);
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
      const approvedDocs = docs.filter((d) => d.status === "approved").length;
      const sentDocs = docs.filter((d) => d.status === "sent" || d.status === "approved").length;
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

  const [projectStatusInput, setProjectStatusInput] = useState<Project["status"]>("active");
  useEffect(() => {
    if (!selectedProject) {
      setProjectStatusInput("active");
      return;
    }
    setProjectStatusInput(selectedProject.status);
  }, [selectedProjectId, selectedProject]);

  const canEditProject = useMemo(() => {
    if (!selectedProject) return false;
    return isAdmin || selectedProject.owner_user_id === meId;
  }, [selectedProject, isAdmin, meId]);

  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clients) map[c.id] = c.name;
    return map;
  }, [clients]);

  async function saveProjectStatus() {
    if (!selectedProject) return;
    if (!canEditProject) return setMsg("Sem permissao para editar este projeto.");
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase
        .from("projects")
        .update({ status: projectStatusInput })
        .eq("id", selectedProject.id);
      if (res.error) throw new Error(res.error.message);
      setMsg("Status do projeto atualizado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar status do projeto.");
    } finally {
      setSaving(false);
    }
  }

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
      const res = await supabase.from("project_deliverables").insert({
        project_id: selectedProjectId,
        title: docTitle.trim(),
        description: docDescription.trim() || null,
        due_date: docDueDate || null,
        // Gestor cria o entregavel; direcionamento de responsavel e' do Coordenador.
        assigned_to: null,
        status: "pending",
      });
      if (res.error) throw new Error(res.error.message);
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

  async function updateDeliverableStatus(id: string, status: Deliverable["status"]) {
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_deliverables").update({ status }).eq("id", id);
      if (res.error) throw new Error(res.error.message);
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
      const res = await supabase.from("project_deliverables").update({ document_url: link.trim() || null }).eq("id", id);
      if (res.error) throw new Error(res.error.message);
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
      const payload = {
        title: (editTitleByDeliverableId[deliverableId] ?? "").trim() || null,
        description: (editDescByDeliverableId[deliverableId] ?? "").trim() || null,
        due_date: (editDueByDeliverableId[deliverableId] ?? "").trim() || null,
      };
      const res = await supabase.from("project_deliverables").update(payload).eq("id", deliverableId);
      if (res.error) throw new Error(res.error.message);
      setMsg("Entregável atualizado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar entregável.");
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

  async function createTeam() {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    const name = newTeamName.trim();
    if (!name) return setMsg("Informe o nome da equipe.");
    setSaving(true);
    setMsg("");
    try {
      const res = await supabase.from("project_teams").insert({ project_id: selectedProjectId, name, created_by: meId || null });
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

  async function addMemberToTeam() {
    if (!selectedProjectId) return setMsg("Selecione um projeto.");
    if (!assignTeamId) return setMsg("Selecione uma equipe.");
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
        team_id: assignTeamId,
        project_id: selectedProjectId,
        user_id: assignUserId,
        added_by: meId || null,
      });
      if (res.error) {
        if ((res.error as { code?: string })?.code === "23505") {
          throw new Error("Este colaborador já está nesta equipe.");
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
              Cliente: {selectedProject.client_id ? (clientNameById[selectedProject.client_id] ?? selectedProject.client_id) : "-"} | Tipo: {projectTypeLabel(selectedProject.project_type)}
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
                  <select
                    value={projectStatusInput}
                    onChange={(e) => setProjectStatusInput(e.target.value as Project["status"])}
                    disabled={!canEditProject || saving}
                    className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white disabled:opacity-60"
                    title={canEditProject ? "Status executivo do projeto" : "Apenas o dono do projeto ou Admin pode editar"}
                  >
                    <option value="active" className="text-slate-900">Ativo</option>
                    <option value="paused" className="text-slate-900">Pausado</option>
                    <option value="done" className="text-slate-900">Concluido</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void saveProjectStatus()}
                    disabled={!canEditProject || saving}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    title={canEditProject ? "Salvar status do projeto" : "Apenas o dono do projeto ou Admin pode editar"}
                  >
                    Salvar status
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum projeto selecionado.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Adicionar equipe</h2>
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
            <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as "coordenador" | "colaborador")} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="coordenador">Coordenador</option>
              <option value="colaborador">Colaborador</option>
            </select>
          </div>
          <button type="button" onClick={() => void addMember()} disabled={!selectedProjectId || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">
            Adicionar na equipe
          </button>

          <div className="space-y-2">
            <p className="text-xs text-slate-500">Membros do projeto</p>
            {selectedMembers.length === 0 ? <p className="text-sm text-slate-500">Nenhum membro.</p> : null}
            {selectedMembers.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <PersonChip name={personLabel(m.user_id)} subtitle={personCargo(m.user_id)} avatarUrl={personAvatar(m.user_id)} />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Equipes do projeto</h3>
            <p className="text-xs text-slate-500">
              Crie equipes nomeadas (ex: Civil, Elétrica) e distribua os membros do projeto.
            </p>

            <div className="grid gap-2 md:grid-cols-3">
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
              >
                Criar equipe
              </button>
            </div>

            {teams.length ? (
              <div className="space-y-3">
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
                  <button
                    type="button"
                    onClick={() => void (assignTeamId ? deleteTeam(assignTeamId) : null)}
                    disabled={saving || !assignTeamId}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-60"
                    title="Excluir equipe selecionada"
                  >
                    Excluir equipe
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
                  >
                    <option value="">Selecione um membro...</option>
                    {selectedMembers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {personLabel(m.user_id)} ({m.member_role})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void addMemberToTeam()}
                    disabled={saving || !assignTeamId || !assignUserId}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                  >
                    Adicionar na equipe
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
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
                    onClick={() => void addMemberToTeam()}
                    disabled={saving || !assignTeamId || !assignUserId}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 md:col-span-3"
                  >
                    Adicionar ao projeto e equipe
                  </button>
                </div>

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
                                  <PersonChip
                                    size="sm"
                                    name={personLabel(r.user_id)}
                                    subtitle={personCargo(r.user_id)}
                                    avatarUrl={personAvatar(r.user_id)}
                                  />
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
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Nenhuma equipe criada ainda (ou SQL de equipes ainda não foi aplicado).
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Lista de documentos entregaveis</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Titulo do entregavel" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input type="date" value={docDueDate} onChange={(e) => setDocDueDate(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input value={docDescription} onChange={(e) => setDocDescription(e.target.value)} placeholder="Descricao" className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
          </div>
          <button type="button" onClick={() => void addDeliverable()} disabled={!selectedProjectId || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">
            Adicionar entregavel
          </button>

          <div className="space-y-3">
            {selectedDeliverables.length === 0 ? <p className="text-sm text-slate-500">Nenhum entregavel.</p> : null}
            {selectedDeliverables.map((d) => {
              const contribs = contributions.filter((c) => c.deliverable_id === d.id);
              return (
                <div key={d.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                    <select value={d.status} onChange={(e) => void updateDeliverableStatus(d.id, e.target.value as Deliverable["status"])} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                      <option value="pending">Pendente</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="sent">Enviado</option>
                      <option value="approved">Aprovado</option>
                    </select>
                  </div>
                  <p className="text-xs text-slate-500">
                    Responsavel: {d.assigned_to ? personLabel(d.assigned_to) : "Nao definido"}
                  </p>
                  {d.document_path ? (
                    <button
                      type="button"
                      onClick={() => void openDeliverableFile(d.id)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Abrir arquivo enviado
                    </button>
                  ) : null}

                  {d.status === "sent" ? (
                    <button
                      type="button"
                      onClick={() => void updateDeliverableStatus(d.id, "approved")}
                      disabled={saving}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Aprovar
                    </button>
                  ) : null}

                  <details
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    open={!!editOpenByDeliverableId[d.id]}
                    onToggle={(e) => {
                      const open = (e.currentTarget as HTMLDetailsElement).open;
                      setEditOpenByDeliverableId((prev) => ({ ...prev, [d.id]: open }));
                    }}
                  >
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">Editar entregável</summary>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <input
                        value={editTitleByDeliverableId[d.id] ?? d.title}
                        onChange={(e) => setEditTitleByDeliverableId((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        placeholder="Título"
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
                        placeholder="Descrição"
                      />
                      <button
                        type="button"
                        onClick={() => void saveDeliverableEdits(d.id)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-60 md:col-span-2"
                      >
                        Salvar alterações
                      </button>
                    </div>
                  </details>

                  <div className="flex flex-wrap gap-2">
                    <input
                      defaultValue={d.document_url ?? ""}
                      placeholder="Link do documento"
                      className="h-9 flex-1 min-w-[220px] rounded-lg border border-slate-200 px-2 text-xs"
                      onBlur={(e) => void updateDocumentLink(d.id, e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-slate-500">Contribuicoes: {contribs.length}</p>
                {contribs.map((c) => (
                  <p key={c.id} className="text-xs text-slate-600">
                      {personLabel(c.user_id)} - {c.contribution_note ?? "Contribuicao registrada"}
                  </p>
                ))}
              </div>
            );
          })}
          </div>
        </section>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}



