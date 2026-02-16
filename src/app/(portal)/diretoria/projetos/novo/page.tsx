"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

type ProjectClientRow = {
  id: string;
  name: string;
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

export default function DiretoriaNovoProjetoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");
  const [clients, setClients] = useState<ProjectClientRow[]>([]);

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectStart, setNewProjectStart] = useState("");
  const [newProjectEnd, setNewProjectEnd] = useState("");
  const [newProjectBudgetTotal, setNewProjectBudgetTotal] = useState("");
  const [newProjectClientId, setNewProjectClientId] = useState("");
  const [newProjectType, setNewProjectType] = useState<ProjectType | "">("");
  const [newProjectScopes, setNewProjectScopes] = useState<ProjectType[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Nao autenticado.");
      setMeId(authData.user.id);

      const clientsRes = await supabase
        .from("project_clients")
        .select("id,name")
        .eq("active", true)
        .order("name", { ascending: true });
      if (clientsRes.error) throw clientsRes.error;
      setClients((clientsRes.data ?? []) as ProjectClientRow[]);
    } catch (e: unknown) {
      setClients([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar cadastro de projeto.");
    } finally {
      setLoading(false);
    }
  }

  function toggleProjectScope(scope: ProjectType) {
    setNewProjectScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function createProject() {
    if (!newProjectName.trim()) return setMsg("Informe o nome do projeto.");
    if (!newProjectClientId) return setMsg("Selecione o cliente do projeto.");
    if (!newProjectType) return setMsg("Selecione o tipo principal do projeto.");
    if (!meId) return setMsg("Usuario nao identificado.");
    setSaving(true);
    setMsg("");
    try {
      const budget = newProjectBudgetTotal.trim() ? Number(newProjectBudgetTotal.replace(",", ".")) : NaN;
      const budget_total = Number.isFinite(budget) && budget > 0 ? budget : null;

      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || null,
          start_date: newProjectStart || null,
          end_date: newProjectEnd || null,
          budget_total,
          client_id: newProjectClientId,
          project_type: newProjectType,
          project_scopes: newProjectScopes,
          owner_user_id: meId,
        })
        .select("id")
        .single<{ id: string }>();
      if (error || !data) throw new Error(error?.message ?? "Falha ao criar projeto.");

      const memberInsert = await supabase.from("project_members").insert({
        project_id: data.id,
        user_id: meId,
        member_role: "gestor",
        added_by: meId,
      });
      if (memberInsert.error) throw new Error(memberInsert.error.message);

      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectStart("");
      setNewProjectEnd("");
      setNewProjectBudgetTotal("");
      setNewProjectClientId("");
      setNewProjectType("");
      setNewProjectScopes([]);
      setMsg("Projeto criado com sucesso.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar projeto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Diretoria - Novo projeto</h1>
            <p className="mt-1 text-sm text-slate-600">Cadastro separado do acompanhamento executivo.</p>
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
          <input
            value={newProjectBudgetTotal}
            onChange={(e) => setNewProjectBudgetTotal(e.target.value)}
            placeholder="Valor/orcamento (opcional) - ex: 250000"
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

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}

