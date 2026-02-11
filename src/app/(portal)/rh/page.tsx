"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Search,
  RefreshCcw,
  Users,
  BadgeCheck,
  AlertTriangle,
  Shield,
  UserRound,
  Power,
} from "lucide-react";

type Role = "colaborador" | "rh" | "admin";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  active: boolean;
  created_at: string | null;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function RhPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [meRole, setMeRole] = useState<Role | null>(null);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string>("");

  // =========================
  // 1) Guard: só RH ou Admin
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

      if (role !== "rh" && role !== "admin") {
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
  // 2) Carregar dados
  // =========================
  async function loadProfiles() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMsg("Sem permissão para listar usuários. Ajuste a policy SELECT do RH (RLS).");
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ProfileRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!checking && (meRole === "rh" || meRole === "admin")) {
      loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, meRole]);

  // =========================
  // 3) Toggle active (RH)
  // =========================
  async function toggleActive(id: string, nextActive: boolean) {
    setSavingId(id);
    setMsg("");

    const { error } = await supabase
      .from("profiles")
      .update({ active: nextActive })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMsg("Falha ao atualizar status. Verifique policy UPDATE do RH (active-only).");
      setSavingId(null);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active: nextActive } : r)));
    setMsg(nextActive ? "Usuário ativado." : "Usuário inativado.");
    setSavingId(null);
  }

  // =========================
  // 4) Busca / filtro local
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
  // 5) Métricas rápidas
  // =========================
  const stats = useMemo(() => {
    const total = rows.length;
    const ativos = rows.filter((r) => r.active).length;
    const inativos = rows.filter((r) => !r.active).length;
    const admins = rows.filter((r) => r.role === "admin").length;
    const rhs = rows.filter((r) => r.role === "rh").length;
    const colabs = rows.filter((r) => r.role === "colaborador").length;

    return { total, ativos, inativos, admins, rhs, colabs };
  }, [rows]);

  if (checking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Validando acesso do RH...</p>
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
              <Users size={18} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">RH — Painel</h1>
              <p className="mt-1 text-sm text-slate-600">
                Listagem e ativação/inativação de usuários (RH/Admin).
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[360px]">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por e-mail, nome ou role..."
                className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2 text-sm outline-none focus:border-slate-300"
              />
            </div>

            <button
              onClick={loadProfiles}
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

      {/* Cards */}
      <div className="grid gap-3 md:grid-cols-6">
        <StatCard icon={<Users size={18} />} title="Total" value={stats.total} />
        <StatCard icon={<BadgeCheck size={18} />} title="Ativos" value={stats.ativos} />
        <StatCard icon={<AlertTriangle size={18} />} title="Inativos" value={stats.inativos} />
        <StatCard icon={<Shield size={18} />} title="Admin" value={stats.admins} />
        <StatCard icon={<UserRound size={18} />} title="RH" value={stats.rhs} />
        <StatCard icon={<UserRound size={18} />} title="Colab." value={stats.colabs} />
      </div>

      {/* Lista */}
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
                <th className="px-6 py-3 font-semibold">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filtered.map((r) => {
                const isSaving = savingId === r.id;

                // ✅ regra: RH não pode mexer em admin (alinhado com a policy)
                const canToggle = r.role !== "admin";

                return (
                  <tr key={r.id} className="text-slate-800">
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900">{r.email ?? "-"}</div>
                      <div className="text-xs text-slate-500">{r.id}</div>
                    </td>

                    <td className="px-6 py-3">
                      {r.full_name ?? <span className="text-slate-400">—</span>}
                    </td>

                    <td className="px-6 py-3">
                      <span
                        className={cx(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                          r.role === "admin"
                            ? "bg-slate-900 text-white"
                            : r.role === "rh"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {r.role}
                      </span>
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
                      <button
                        disabled={isSaving || !canToggle}
                        onClick={() => {
                          const next = !r.active;
                          const ok = window.confirm(
                            next
                              ? `Ativar o usuário ${r.email ?? ""}?`
                              : `Inativar o usuário ${r.email ?? ""}?`
                          );
                          if (!ok) return;
                          toggleActive(r.id, next);
                        }}
                        className={cx(
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
                          !canToggle
                            ? "border-slate-200 bg-slate-50 text-slate-500"
                            : r.active
                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        )}
                        title={!canToggle ? "Admin não pode ser alterado pelo RH" : undefined}
                      >
                        <Power size={14} />
                        {r.active ? "Inativar" : "Ativar"}
                      </button>

                      {isSaving && <span className="ml-3 text-xs text-slate-500">Salvando...</span>}
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
          RH pode ativar/inativar usuários (exceto Admin). Alterar role permanece na tela Admin.
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
