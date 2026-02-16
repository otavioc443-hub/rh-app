"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
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

export default function CoordenadorProjetosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectClients, setProjectClients] = useState<ProjectClient[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [directoryById, setDirectoryById] = useState<Record<string, ProjectMemberDirectoryRow>>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [selectedDeliverableId, setSelectedDeliverableId] = useState("");
  const [dirDescription, setDirDescription] = useState("");
  const [dirDueDate, setDirDueDate] = useState("");
  const [dirAssignedTo, setDirAssignedTo] = useState("");

  const [contribTextByDeliverable, setContribTextByDeliverable] = useState<Record<string, string>>({});
  const [docLinkByDeliverable, setDocLinkByDeliverable] = useState<Record<string, string>>({});

  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
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
        setProfilesById({});
        setSelectedProjectId("");
        return;
      }

      const [projRes, memRes, delRes] = await Promise.all([
        supabase.from("projects").select("id,name,description,status,client_id,project_type,project_scopes").in("id", projectIds),
        supabase.from("project_members").select("id,project_id,user_id,member_role").in("project_id", projectIds),
        supabase
          .from("project_deliverables")
          .select("id,project_id,title,description,due_date,assigned_to,status,document_url,document_path,document_file_name,submitted_by")
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

      let nextContributions: Contribution[] = [];
      if (nextDeliverables.length > 0) {
        const contribRes = await supabase
          .from("deliverable_contributions")
          .select("id,deliverable_id,user_id,contribution_note,created_at")
          .in("deliverable_id", nextDeliverables.map((d) => d.id))
          .order("created_at", { ascending: false });
        if (contribRes.error) throw new Error(contribRes.error.message);
        nextContributions = (contribRes.data ?? []) as Contribution[];
        setContributions(nextContributions);
      } else {
        setContributions([]);
      }

      const userIds = Array.from(
        new Set([
          ...nextMembers.map((m) => m.user_id),
          ...nextDeliverables.map((d) => d.assigned_to).filter(Boolean),
          ...nextDeliverables.map((d) => d.submitted_by).filter(Boolean),
          ...nextContributions.map((c) => c.user_id),
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
      setTeams([]);
      setTeamMembers([]);
    }
  }

  useEffect(() => {
    void loadTeams(selectedProjectId);
  }, [selectedProjectId]);

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
    const sent = projectDeliverables.filter((d) => d.status === "sent" || d.status === "approved").length;
    const approved = projectDeliverables.filter((d) => d.status === "approved").length;
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
    return cargo || "Cargo não informado";
  };

  const personAvatar = (userId: string) => {
    const d = directoryById[userId];
    const url = typeof d?.avatar_url === "string" ? d.avatar_url.trim() : "";
    return url || null;
  };

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
      const res = await supabase
        .from("project_deliverables")
        .update({
          // Coordenador direciona um documento existente do projeto para alguem da equipe.
          assigned_to: dirAssignedTo,
          due_date: dirDueDate || null,
          description: dirDescription.trim() || null,
          status: selectedDeliverable?.status === "pending" ? "in_progress" : selectedDeliverable?.status,
        })
        .eq("id", selectedDeliverableId);
      if (res.error) throw new Error(res.error.message);

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
      const res = await supabase
        .from("project_deliverables")
        .update({
          document_url: link || null,
          status: link ? "sent" : deliverable.status,
          submitted_by: link ? meId : deliverable.submitted_by,
          submitted_at: link ? new Date().toISOString() : null,
        })
        .eq("id", deliverable.id);
      if (res.error) throw new Error(res.error.message);
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
      const res = await supabase.from("project_deliverables").update({ status }).eq("id", deliverableId);
      if (res.error) throw new Error(res.error.message);
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
      setContribTextByDeliverable((prev) => ({ ...prev, [deliverableId]: "" }));
      setMsg("Contribuicao registrada.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar contribuicao.");
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
        <p className="text-xs text-slate-500">Crie equipes (Civil, Elétrica, etc) e distribua os membros do projeto.</p>

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
            Nenhuma equipe criada ainda (ou SQL de equipes ainda não foi aplicado).
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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Campo de envio de documentos</h2>
        {projectDeliverables.length === 0 ? <p className="text-sm text-slate-500">Sem documentos no projeto.</p> : null}
        {projectDeliverables.map((d) => {
          const list = contributions.filter((c) => c.deliverable_id === d.id);
          return (
            <div key={d.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                <select value={d.status} onChange={(e) => void setStatus(d.id, e.target.value as Deliverable["status"])} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
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
                  onClick={() => void setStatus(d.id, "approved")}
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

              <p className="text-xs text-slate-500">Contribuidores ({list.length})</p>
              {list.map((c) => (
                <p key={c.id} className="text-xs text-slate-600">
                  {personLabel(c.user_id)} - {c.contribution_note ?? "Contribuicao"}
                </p>
              ))}
            </div>
          );
        })}
      </section>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}
