"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
type ProjectStatus = "active" | "paused" | "done";
type ProjectStage = "ofertas" | "desenvolvimento" | "as_built" | "pausado" | "cancelado";

type ProjectClientRow = {
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
  project_type: ProjectType | null;
  project_scopes: string[] | null;
  project_stage: ProjectStage | null;
  status: ProjectStatus;
  owner_user_id: string;
  created_at: string;
};

type ProjectDraft = {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  budget_total: string;
  client_id: string;
  project_type: ProjectType | "";
  project_scopes: ProjectType[];
  project_stage: ProjectStage;
  owner_user_id: string;
};

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
  return `Gestor ${manager.id.slice(0, 8)}`;
}

function stageLabel(stage: ProjectStage | null | undefined) {
  if (stage === "ofertas") return "Ofertas";
  if (stage === "desenvolvimento") return "Desenvolvimento";
  if (stage === "as_built") return "As Built";
  if (stage === "pausado") return "Pausado";
  if (stage === "cancelado") return "Cancelado";
  return "-";
}

function buildDraftFromProject(project: ExistingProjectRow): ProjectDraft {
  return {
    name: project.name ?? "",
    description: project.description ?? "",
    start_date: project.start_date ?? "",
    end_date: project.end_date ?? "",
    budget_total: project.budget_total != null ? String(project.budget_total) : "",
    client_id: project.client_id ?? "",
    project_type: project.project_type ?? "",
    project_scopes: ((project.project_scopes ?? []) as ProjectType[]).filter((v) =>
      PROJECT_TYPE_OPTIONS.some((opt) => opt.value === v)
    ),
    project_stage: project.project_stage ?? "ofertas",
    owner_user_id: project.owner_user_id,
  };
}

export default function DiretoriaNovoProjetoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");

  const [clients, setClients] = useState<ProjectClientRow[]>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [existingProjects, setExistingProjects] = useState<ExistingProjectRow[]>([]);
  const [draftByProjectId, setDraftByProjectId] = useState<Record<string, ProjectDraft>>({});

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectStart, setNewProjectStart] = useState("");
  const [newProjectEnd, setNewProjectEnd] = useState("");
  const [newProjectBudgetTotal, setNewProjectBudgetTotal] = useState("");
  const [newProjectClientId, setNewProjectClientId] = useState("");
  const [newProjectType, setNewProjectType] = useState<ProjectType | "">("");
  const [newProjectScopes, setNewProjectScopes] = useState<ProjectType[]>([]);
  const [newProjectStage, setNewProjectStage] = useState<ProjectStage>("ofertas");
  const [newProjectManagerId, setNewProjectManagerId] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const managersById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of managers) map[m.id] = managerLabel(m);
    return map;
  }, [managers]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Nao autenticado.");
      setMeId(authData.user.id);

      const [clientsRes, managersRes, projectsRes] = await Promise.all([
        supabase.from("project_clients").select("id,name").eq("active", true).order("name", { ascending: true }),
        supabase.from("profiles").select("id,full_name,email").eq("active", true).eq("role", "gestor").order("full_name", { ascending: true }),
        supabase
          .from("projects")
          .select("id,name,description,start_date,end_date,budget_total,client_id,project_type,project_scopes,project_stage,status,owner_user_id,created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (managersRes.error) throw managersRes.error;
      if (projectsRes.error) throw projectsRes.error;

      const nextClients = (clientsRes.data ?? []) as ProjectClientRow[];
      const nextManagers = (managersRes.data ?? []) as ManagerRow[];
      const nextProjects = (projectsRes.data ?? []) as ExistingProjectRow[];

      setClients(nextClients);
      setManagers(nextManagers);
      setExistingProjects(nextProjects);

      setDraftByProjectId(() => {
        const next: Record<string, ProjectDraft> = {};
        for (const project of nextProjects) next[project.id] = buildDraftFromProject(project);
        return next;
      });

      if (!newProjectManagerId && nextManagers.length > 0) {
        setNewProjectManagerId(nextManagers[0].id);
      }
    } catch (e: unknown) {
      setClients([]);
      setManagers([]);
      setExistingProjects([]);
      setDraftByProjectId({});
      setMsg(e instanceof Error ? e.message : "Erro ao carregar cadastro de projeto.");
    } finally {
      setLoading(false);
    }
  }

  function toggleProjectScope(scope: ProjectType) {
    setNewProjectScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
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

  async function ensureProjectManagerMembership(projectId: string, managerId: string) {
    await supabase.from("project_members").upsert(
      {
        project_id: projectId,
        user_id: managerId,
        member_role: "gestor",
        added_by: meId || null,
      },
      { onConflict: "project_id,user_id" }
    );
  }

  async function createProject() {
    if (!newProjectName.trim()) return setMsg("Informe o nome do projeto.");
    if (!newProjectClientId) return setMsg("Selecione o cliente do projeto.");
    if (!newProjectType) return setMsg("Selecione o tipo principal do projeto.");
    if (!newProjectManagerId) return setMsg("Selecione o gestor responsavel.");
    if (!meId) return setMsg("Usuario nao identificado.");
    setSaving(true);
    setMsg("");
    try {
      const budget = newProjectBudgetTotal.trim() ? Number(newProjectBudgetTotal.replace(",", ".")) : NaN;
      const budgetTotal = Number.isFinite(budget) && budget > 0 ? budget : null;

      const payload = {
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || null,
        start_date: newProjectStart || null,
        end_date: newProjectEnd || null,
        budget_total: budgetTotal,
        client_id: newProjectClientId,
        project_type: newProjectType,
        project_scopes: newProjectScopes,
        project_stage: newProjectStage,
        status: statusFromStage(newProjectStage),
        owner_user_id: newProjectManagerId,
      };

      let projectId: string | null = null;
      const insertWithStage = await supabase.from("projects").insert(payload).select("id").single<{ id: string }>();
      if (insertWithStage.error) {
        const fallback = await supabase
          .from("projects")
          .insert({
            name: payload.name,
            description: payload.description,
            start_date: payload.start_date,
            end_date: payload.end_date,
            budget_total: payload.budget_total,
            client_id: payload.client_id,
            project_type: payload.project_type,
            project_scopes: payload.project_scopes,
            status: payload.status,
            owner_user_id: payload.owner_user_id,
          })
          .select("id")
          .single<{ id: string }>();
        if (fallback.error || !fallback.data?.id) throw new Error(fallback.error?.message ?? "Falha ao criar projeto.");
        projectId = fallback.data.id;
      } else {
        projectId = insertWithStage.data?.id ?? null;
      }
      if (!projectId) throw new Error("Falha ao criar projeto.");

      await ensureProjectManagerMembership(projectId, newProjectManagerId);

      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectStart("");
      setNewProjectEnd("");
      setNewProjectBudgetTotal("");
      setNewProjectClientId("");
      setNewProjectType("");
      setNewProjectScopes([]);
      setNewProjectStage("ofertas");
      setMsg("Projeto criado com sucesso e gestor direcionado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar projeto.");
    } finally {
      setSaving(false);
    }
  }

  async function saveExistingProject(projectId: string) {
    const draft = draftByProjectId[projectId];
    if (!draft) return;
    if (!draft.name.trim()) return setMsg("Nome do projeto e obrigatorio.");
    if (!draft.client_id) return setMsg("Cliente e obrigatorio.");
    if (!draft.project_type) return setMsg("Tipo principal e obrigatorio.");
    if (!draft.owner_user_id) return setMsg("Selecione o gestor responsavel.");

    setSaving(true);
    setMsg("");
    try {
      const budget = draft.budget_total.trim() ? Number(draft.budget_total.replace(",", ".")) : NaN;
      const budgetTotal = Number.isFinite(budget) && budget > 0 ? budget : null;

      const { error } = await supabase
        .from("projects")
        .update({
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          start_date: draft.start_date || null,
          end_date: draft.end_date || null,
          budget_total: budgetTotal,
          client_id: draft.client_id,
          project_type: draft.project_type,
          project_scopes: draft.project_scopes,
          project_stage: draft.project_stage,
          status: statusFromStage(draft.project_stage),
          owner_user_id: draft.owner_user_id,
        })
        .eq("id", projectId);
      if (error) throw error;

      await ensureProjectManagerMembership(projectId, draft.owner_user_id);

      setMsg("Projeto atualizado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar projeto.");
    } finally {
      setSaving(false);
    }
  }

  function cancelExistingProjectEdit(project: ExistingProjectRow) {
    setDraftByProjectId((prev) => ({
      ...prev,
      [project.id]: buildDraftFromProject(project),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Diretoria - Novo projeto</h1>
            <p className="mt-1 text-sm text-slate-600">Cadastro com direcionamento de gestor responsavel.</p>
          </div>
          <Link
            href="/diretoria/projetos"
            className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Voltar para acompanhamento
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Cadastro de projeto</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nome do projeto"
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <select
            value={newProjectManagerId}
            onChange={(e) => setNewProjectManagerId(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          >
            <option value="">Selecione o gestor responsavel...</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {managerLabel(m)}
              </option>
            ))}
          </select>
          <select
            value={newProjectClientId}
            onChange={(e) => setNewProjectClientId(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          >
            <option value="">Selecione o cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={newProjectType}
            onChange={(e) => setNewProjectType(e.target.value as ProjectType | "")}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          >
            <option value="">Tipo principal do projeto...</option>
            {PROJECT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={newProjectStage}
            onChange={(e) => setNewProjectStage(e.target.value as ProjectStage)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          >
            <option value="ofertas">Etapa inicial: Ofertas</option>
            <option value="desenvolvimento">Etapa inicial: Desenvolvimento</option>
            <option value="as_built">Etapa inicial: As Built</option>
            <option value="pausado">Etapa inicial: Pausado</option>
            <option value="cancelado">Etapa inicial: Cancelado</option>
          </select>
          <input
            value={newProjectBudgetTotal}
            onChange={(e) => setNewProjectBudgetTotal(e.target.value)}
            placeholder="Orcamento (opcional) - ex: 250000"
            inputMode="decimal"
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <input
            type="date"
            value={newProjectStart}
            onChange={(e) => setNewProjectStart(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <input
            type="date"
            value={newProjectEnd}
            onChange={(e) => setNewProjectEnd(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <input
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
            placeholder="Descricao (opcional)"
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"
          />
          <div className="rounded-xl border border-slate-200 p-3 md:col-span-2">
            <p className="text-xs font-semibold text-slate-700">Escopos/disciplinas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROJECT_TYPE_OPTIONS.map((opt) => {
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
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void createProject()}
            disabled={saving || loading}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Criar projeto
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Projetos cadastrados (edicao)</h2>
        <p className="mt-1 text-xs text-slate-600">Edite dados do projeto e redirecione o gestor responsavel.</p>
        <div className="mt-3 space-y-3">
          {existingProjects.length ? (
            existingProjects.map((project) => {
              const draft = draftByProjectId[project.id];
              if (!draft) return null;
              return (
                <details key={project.id} className="rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                    {project.name} - {stageLabel(project.project_stage)} - {managersById[project.owner_user_id] ?? project.owner_user_id.slice(0, 8)}
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      value={draft.name}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, name: e.target.value } }))}
                      placeholder="Nome do projeto"
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
                    />
                    <select
                      value={draft.owner_user_id}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, owner_user_id: e.target.value } }))}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="">Selecione o gestor responsavel...</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {managerLabel(m)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.client_id}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, client_id: e.target.value } }))}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="">Selecione o cliente...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.project_type}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, project_type: e.target.value as ProjectType | "" } }))}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="">Tipo principal do projeto...</option>
                      {PROJECT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.project_stage}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, project_stage: e.target.value as ProjectStage } }))}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="ofertas">Ofertas</option>
                      <option value="desenvolvimento">Desenvolvimento</option>
                      <option value="as_built">As Built</option>
                      <option value="pausado">Pausado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                    <input
                      value={draft.budget_total}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, budget_total: e.target.value } }))}
                      placeholder="Orcamento (opcional)"
                      inputMode="decimal"
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
                    />
                    <input
                      type="date"
                      value={draft.start_date}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, start_date: e.target.value } }))}
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
                    />
                    <input
                      type="date"
                      value={draft.end_date}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, end_date: e.target.value } }))}
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
                    />
                    <input
                      value={draft.description}
                      onChange={(e) => setDraftByProjectId((prev) => ({ ...prev, [project.id]: { ...draft, description: e.target.value } }))}
                      placeholder="Descricao (opcional)"
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"
                    />
                    <div className="rounded-xl border border-slate-200 p-3 md:col-span-2">
                      <p className="text-xs font-semibold text-slate-700">Escopos/disciplinas</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PROJECT_TYPE_OPTIONS.map((opt) => {
                          const checked = draft.project_scopes.includes(opt.value);
                          return (
                            <label key={opt.value} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700">
                              <input type="checkbox" checked={checked} onChange={() => toggleExistingScope(project.id, opt.value)} />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveExistingProject(project.id)}
                        disabled={saving || loading}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                      >
                        Salvar edicao
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelExistingProjectEdit(project)}
                        disabled={saving || loading}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cancelar edicao
                      </button>
                    </div>
                  </div>
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

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}
