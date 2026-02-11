"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Search,
  RefreshCcw,
  Shield,
  UserRound,
  BadgeCheck,
  AlertTriangle,
  Power,
  MailPlus,
} from "lucide-react";

type Role = "colaborador" | "rh" | "admin";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  active: boolean;
  created_at: string | null;
  company_id?: string | null;
  department_id?: string | null;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AdminPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [meRole, setMeRole] = useState<Role | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string>("");

  // convite (sem empresa/setor aqui — isso vai na tela /admin/empresas)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("colaborador");
  const [inviting, setInviting] = useState(false);

  // =========================
  // 1) Guard: só admin entra
  // =========================
  useEffect(() => {
    let alive = true;

    async function guard() {
      setMsg("");
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;

      if (!user) {
        router.replace("/");
        return;
      }

      setMyUserId(user.id);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (error || !profile) {
        setMsg("Não foi possível validar seu perfil. Verifique as policies (RLS).");
        router.replace("/home");
        return;
      }

      if (!profile.active) {
        setMsg("Seu usuário está inativo. Procure um administrador.");
        router.replace("/home");
        return;
      }

      const role = profile.role as Role;
      setMeRole(role);

      if (role !== "admin") {
        router.replace("/home");
        return;
      }

      setChecking(false);
    }

    guard();

    return () => {
      alive = false;
    };
  }, [router]);

  // =========================
  // Helpers: token p/ API admin
  // =========================
  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getAccessToken();
    if (!token) throw new Error("Sem sessão/token. Faça login novamente.");

    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || "Erro na requisição.");
    }
    return json;
  }

  // =========================
  // 2) Carregar lista profiles (tabela)
  // =========================
  async function loadProfiles() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, active, created_at, company_id, department_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMsg("Erro ao carregar usuários. Verifique policy SELECT do admin.");
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ProfileRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!checking && meRole === "admin") {
      loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, meRole]);

  // =========================
  // 3) Busca local profiles
  // =========================
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((r) => {
      const email = (r.email ?? "").toLowerCase();
      const name = (r.full_name ?? "").toLowerCase();
      const role = (r.role ?? "").toLowerCase();
      return email.includes(term) || name.includes(term) || role.includes(term);
    });
  }, [q, rows]);

  // =========================
  // 4) Updates role/active
  // =========================
  async function updateRole(id: string, newRole: Role) {
    setSavingId(id);
    setMsg("");

    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", id);

    if (error) {
      console.error(error);
      setMsg("Falha ao atualizar role. Verifique policy UPDATE do admin.");
      setSavingId(null);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role: newRole } : r)));
    setMsg("Role atualizada com sucesso.");
    setSavingId(null);
  }

  async function toggleActive(id: string, nextActive: boolean) {
    if (myUserId && id === myUserId && nextActive === false) {
      alert("Você não pode inativar seu próprio usuário admin.");
      return;
    }

    setSavingId(id);
    setMsg("");

    const { error } = await supabase.from("profiles").update({ active: nextActive }).eq("id", id);

    if (error) {
      console.error(error);
      setMsg("Falha ao atualizar status (active). Verifique policy UPDATE do admin.");
      setSavingId(null);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active: nextActive } : r)));
    setMsg(nextActive ? "Usuário ativado." : "Usuário inativado.");
    setSavingId(null);
  }

  // =========================
  // 5) Convite (simples) — empresa/setor será definido na tela Empresas
  // =========================
  async function inviteUser() {
    setMsg("");

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setMsg("Informe um e-mail válido para convidar.");
      return;
    }

    setInviting(true);

    try {
      // Você pode manter /api/admin/invite como está,
      // porém agora ele precisa aceitar convite sem company_id,
      // OU você move o convite completo (empresa/setor) para /admin/empresas.
      await adminFetch("/api/admin/invite", {
        method: "POST",
        body: JSON.stringify({ email, role: inviteRole }),
      });

      setMsg(`Convite enviado para ${email}. O usuário definirá a senha pelo e-mail.`);
      setInviteEmail("");
      setInviteRole("colaborador");

      await loadProfiles();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setInviting(false);
    }
  }

  if (checking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Validando acesso de administrador...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Painel Admin</h1>
              <p className="mt-1 text-sm text-slate-600">
                Controle de usuários, roles e acesso. (Cadastro de empresas fica em “Cadastro de empresas”.)
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[320px]">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por e-mail, nome ou role..."
                className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2 text-sm outline-none focus:border-slate-300"
              />
            </div>

            <button
              onClick={() => loadProfiles()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              disabled={loading}
            >
              <RefreshCcw size={16} className={cx(loading && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {msg}
          </div>
        )}
      </div>

      {/* Convite simples */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
            <MailPlus size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Convidar usuário</h2>
            <p className="mt-1 text-sm text-slate-600">
              Convite básico. Para vincular empresa/setor por CNPJ, use a tela “Cadastro de empresas”.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600">E-mail</label>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="usuario@empresa.com.br"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                >
                  <option value="colaborador">colaborador</option>
                  <option value="rh">rh</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={inviteUser}
                disabled={inviting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                <MailPlus size={16} />
                {inviting ? "Enviando..." : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard icon={<UserRound size={18} />} title="Total" value={rows.length} subtitle="Usuários em profiles" />
        <StatCard
          icon={<BadgeCheck size={18} />}
          title="Ativos"
          value={rows.filter((r) => r.active).length}
          subtitle="Podem acessar o portal"
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          title="Inativos"
          value={rows.filter((r) => !r.active).length}
          subtitle="Acesso bloqueado"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">Usuários ({filtered.length})</p>
          {loading && <p className="text-xs text-slate-500">Carregando...</p>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-6 py-3 font-semibold">E-mail</th>
                <th className="px-6 py-3 font-semibold">Nome</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filtered.map((r) => {
                const isSaving = savingId === r.id;

                return (
                  <tr key={r.id} className="text-slate-800">
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900">{r.email ?? "-"}</div>
                      <div className="text-xs text-slate-500">{r.id}</div>
                    </td>

                    <td className="px-6 py-3">{r.full_name ?? <span className="text-slate-400">—</span>}</td>

                    <td className="px-6 py-3">
                      <select
                        value={r.role}
                        disabled={isSaving}
                        onChange={(e) => updateRole(r.id, e.target.value as Role)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 disabled:opacity-60"
                      >
                        <option value="colaborador">colaborador</option>
                        <option value="rh">rh</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>

                    <td className="px-6 py-3">
                      <span
                        className={cx(
                          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                          r.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        )}
                      >
                        <span className={cx("h-2 w-2 rounded-full", r.active ? "bg-emerald-500" : "bg-rose-500")} />
                        {r.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          disabled={isSaving}
                          onClick={() => {
                            const next = !r.active;
                            const ok = window.confirm(
                              next ? `Ativar o usuário ${r.email ?? ""}?` : `Inativar o usuário ${r.email ?? ""}?`
                            );
                            if (!ok) return;
                            toggleActive(r.id, next);
                          }}
                          className={cx(
                            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-60",
                            r.active
                              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          )}
                        >
                          <Power size={14} />
                          {r.active ? "Inativar" : "Ativar"}
                        </button>

                        {isSaving && <span className="text-xs text-slate-500">Salvando...</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
          Cadastro de empresas e setores foi movido para “Admin → Cadastro de empresas”.
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">{icon}</div>
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
