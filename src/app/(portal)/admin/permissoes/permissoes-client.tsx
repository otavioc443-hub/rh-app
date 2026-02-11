"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "admin";

type UserPermissionRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role | null;
  active: boolean | null;
  company_id: string | null;
  department_id: string | null;
  department_name: string | null; // ✅ vindo da VIEW
};

type DepartmentRow = {
  id: string;
  name: string;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function prettyRole(r: Role | null) {
  if (!r) return "—";
  if (r === "colaborador") return "Colaborador";
  if (r === "coordenador") return "Coordenador";
  if (r === "gestor") return "Gestor";
  if (r === "rh") return "RH";
  if (r === "admin") return "Admin";
  return r;
}

export default function PermissoesClient() {
  const { loading: roleLoading, role: viewerRole } = useUserRole();
  const canView = viewerRole === "admin" || viewerRole === "rh";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<UserPermissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(200);

  // ✅ departments (para mostrar nome e dropdown)
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

  // modal
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UserPermissionRow | null>(null);

  // campos editáveis
  const [editRole, setEditRole] = useState<Role>("colaborador");
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editDepartmentId, setEditDepartmentId] = useState<string>("");

  const deptNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.name);
    return map;
  }, [departments]);

  // roles permitidas conforme quem está editando
  const roleOptions: Role[] = useMemo(() => {
    if (viewerRole === "admin") return ["colaborador", "coordenador", "gestor", "rh", "admin"];
    return ["colaborador", "coordenador", "gestor"];
  }, [viewerRole]);

  async function fetchDepartments() {
    setDeptLoading(true);
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id,name")
        .order("name", { ascending: true })
        .limit(500);

      if (error) throw error;
      setDepartments((data ?? []) as DepartmentRow[]);
    } catch (e: unknown) {
      // não quebra a tela — só não mostra os nomes
      const message = e instanceof Error ? e.message : "Erro ao carregar departments.";
      console.warn("Falha ao carregar departments:", message);
      setDepartments([]);
    } finally {
      setDeptLoading(false);
    }
  }

  async function fetchProfiles() {
    setLoading(true);
    setError(null);

    try {
      let q = supabase
        .from("admin_profiles_view")
        .select("id, full_name, email, role, active, company_id, department_id, department_name")
        .order("full_name", { ascending: true })
        .limit(limit);

      const s = search.trim();
      if (s) {
        q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,department_name.ilike.%${s}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      setRows((data ?? []) as UserPermissionRow[]);
    } catch (e: unknown) {
      setError(
        (e instanceof Error ? e.message : null) ??
          "Não foi possível carregar dados. Verifique se a VIEW admin_profiles_view existe e se RLS permite SELECT."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    fetchDepartments();
    fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, limit]);

  useEffect(() => {
    if (!canView) return;
    const t = setTimeout(fetchProfiles, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const name = (r.full_name ?? "").toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      const rr = (r.role ?? "").toString().toLowerCase();
      const dept = (r.department_name ?? "").toLowerCase();
      return name.includes(s) || email.includes(s) || rr.includes(s) || dept.includes(s);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const activeCount = rows.filter((r) => r.active).length;
    return { total, activeCount };
  }, [rows]);

  function openEditModal(r: UserPermissionRow) {
    setSelected(r);
    setEditRole((r.role ?? "colaborador") as Role);
    setEditActive(r.active ?? false);
    setEditDepartmentId(r.department_id ?? "");
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);

    try {
      if (viewerRole !== "admin" && (editRole === "admin" || editRole === "rh")) {
        throw new Error("Você não tem permissão para atribuir essa role.");
      }

      const payload: { role: Role; active: boolean; department_id: string | null } = {
        role: editRole,
        active: editActive,
        department_id: editDepartmentId ? editDepartmentId : null,
      };

      // UPDATE direto na tabela profiles (mais seguro)
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", selected.id)
        .select("id, full_name, email, role, active, company_id, department_id")
        .single();

      if (error) throw error;

      // Recarrega a lista via VIEW para atualizar o department_name
      await fetchProfiles();

      closeModal();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao salvar. Verifique RLS/Policy.");
    } finally {
      setSaving(false);
    }
  }

  if (roleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Carregando permissões...</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Permissões</h1>
        <p className="mt-2 text-sm text-slate-700">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Permissões</h1>
            <p className="mt-1 text-sm text-slate-600">
              Agora com Departments integrados (nome do departamento na tabela e dropdown de seleção).
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchDepartments}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              disabled={deptLoading}
            >
              {deptLoading ? "Carregando depts..." : "Atualizar depts"}
            </button>

            <button
              onClick={fetchProfiles}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Atualizar lista
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Usuários</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Ativos</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.activeCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Departments cadastrados</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{departments.length}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="block text-xs font-semibold text-slate-700">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, e-mail, role ou departamento"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Limite</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Usuário</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Ativo</th>
                <th className="px-4 py-3 font-semibold">Departamento</th>
                <th className="px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={5}>
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={5}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="bg-white">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">{r.full_name ?? "—"}</span>
                        <span className="text-xs text-slate-600">{r.email ?? r.id}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-800">{prettyRole(r.role)}</td>

                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                          r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {r.active ? "Sim" : "Não"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      {r.department_name ?? (r.department_id ? r.department_id.slice(0, 8) + "…" : "—")}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(r)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {open && selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900">Editar permissões</h2>
              <p className="mt-1 text-sm text-slate-600">
                {selected.full_name ?? "—"} • {selected.email ?? selected.id}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {prettyRole(r)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Ativo</p>
                  <p className="text-xs text-slate-600">Desativar bloqueia o acesso ao portal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditActive((v) => !v)}
                  className={cx(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    editActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                  )}
                >
                  {editActive ? "Sim" : "Não"}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Departamento</label>
                {departments.length === 0 ? (
                  <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    Sua tabela <b>departments</b> ainda está vazia. Cadastre departments para selecionar por nome.
                    <div className="mt-2 text-xs text-slate-500">
                      Por enquanto você pode deixar vazio, ou informar um UUID manualmente.
                    </div>

                    <input
                      value={editDepartmentId}
                      onChange={(e) => setEditDepartmentId(e.target.value)}
                      placeholder="UUID do department (opcional)"
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <select
                    value={editDepartmentId || ""}
                    onChange={(e) => setEditDepartmentId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">— Sem departamento —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.id.slice(0, 6)}…)
                      </option>
                    ))}
                  </select>
                )}

                {editDepartmentId && departments.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Selecionado: <b>{deptNameById.get(editDepartmentId) ?? "—"}</b>
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-5">
              <button
                onClick={() => {
                  setError(null);
                  setOpen(false);
                  setSelected(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                className={cx(
                  "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white",
                  saving && "opacity-70 cursor-not-allowed"
                )}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
