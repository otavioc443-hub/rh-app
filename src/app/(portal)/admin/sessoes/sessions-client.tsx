"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type LogoutReason = "manual" | "idle" | "token_expired" | null;
type SessionMode = "online" | "all";
type SessionReasonFilter = "all" | "manual" | "idle" | "token_expired";

type SessionRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  department_id: string | null;
  login_at: string;
  last_seen_at: string;
  logout_at: string | null;
  logout_reason: LogoutReason;
  user_agent: string | null;

  full_name: string | null;
  email: string | null;
};

const ONLINE_WINDOW_MINUTES = 2;

function toLocal(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("pt-BR");
}

function minutesAgo(dt: string) {
  const diffMs = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m <= 0) return "agora";
  if (m === 1) return "1 min atrás";
  return `${m} min atrás`;
}

function getOnlineStatus(lastSeen: string, logoutAt: string | null) {
  const lastSeenMs = new Date(lastSeen).getTime();
  const online = !logoutAt && lastSeenMs >= Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000;
  const ageText = minutesAgo(lastSeen);
  return { online, ageText };
}

// Simplificação segura do user_agent (sem libs)
function simplifyUA(ua: string | null) {
  if (!ua) return { browser: "—", device: "—" };

  const s = ua.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod/.test(s);
  const device = isMobile ? "Mobile" : "Desktop";

  let browser = "Outro";
  if (s.includes("edg/")) browser = "Edge";
  else if (s.includes("chrome/")) browser = "Chrome";
  else if (s.includes("firefox/")) browser = "Firefox";
  else if (s.includes("safari/") && !s.includes("chrome/")) browser = "Safari";

  return { browser, device };
}

function escapeCsv(value: unknown) {
  const str = String(value ?? "");
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// ✅ sempre gera CSV com cabeçalho, mesmo sem linhas
function downloadCsvWithHeaders(filename: string, headers: string[], rows: Record<string, unknown>[]) {
  const csv =
    headers.join(";") +
    "\n" +
    rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(";")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export default function SessionsClient() {
  const { loading: roleLoading, role } = useUserRole();
  const canView = role === "admin" || role === "rh";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [mode, setMode] = useState<SessionMode>("online");
  const [reason, setReason] = useState<SessionReasonFilter>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  // ✅ filtro por department_id (por enquanto UUID)
  const [departmentId, setDepartmentId] = useState<"all" | string>("all");

  async function fetchSessions() {
    setLoading(true);
    setError(null);

    try {
      let q = supabase
        .from("session_audit_view")
        .select(
          "id,user_id,company_id,department_id,login_at,last_seen_at,logout_at,logout_reason,user_agent,full_name,email"
        )
        .order("last_seen_at", { ascending: false })
        .limit(limit);

      if (mode === "online") {
        const since = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000).toISOString();
        q = q.is("logout_at", null).gte("last_seen_at", since);
      }

      if (reason !== "all") {
        q = q.eq("logout_reason", reason);
      }

      if (departmentId !== "all") {
        q = q.eq("department_id", departmentId);
      }

      if (search.trim()) {
        const s = search.trim();
        q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      setRows((data ?? []) as SessionRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar sessões.");
    } finally {
      setLoading(false);
    }
  }

  // auto-refresh
  useEffect(() => {
    if (!canView) return;
    fetchSessions();
    const t = setInterval(fetchSessions, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, mode, reason, limit, departmentId]);

  // debounce da busca
  useEffect(() => {
    if (!canView) return;
    const t = setTimeout(fetchSessions, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // opções de departamento presentes na lista (sem depender de tabela departments)
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.department_id) set.add(r.department_id);
    }
    return Array.from(set).sort();
  }, [rows]);

  const stats = useMemo(() => {
    const online = rows.filter((r) => getOnlineStatus(r.last_seen_at, r.logout_at).online).length;
    const idle = rows.filter((r) => r.logout_reason === "idle").length;
    const manual = rows.filter((r) => r.logout_reason === "manual").length;
    return { online, idle, manual };
  }, [rows]);

  function handleExportCsv() {
    const headers = [
      "status",
      "nome",
      "email",
      "user_id",
      "department_id",
      "login_at",
      "last_seen_at",
      "last_seen_humano",
      "logout_at",
      "logout_reason",
      "dispositivo",
      "user_agent",
    ];

    const exportRows = rows.map((r) => {
      const st = getOnlineStatus(r.last_seen_at, r.logout_at);
      const ua = simplifyUA(r.user_agent);

      return {
        status: st.online ? "Online" : "Offline",
        nome: r.full_name ?? "",
        email: r.email ?? "",
        user_id: r.user_id,
        department_id: r.department_id ?? "",
        login_at: r.login_at,
        last_seen_at: r.last_seen_at,
        last_seen_humano: st.ageText,
        logout_at: r.logout_at ?? "",
        logout_reason: r.logout_reason ?? "",
        dispositivo: `${ua.browser} / ${ua.device}`,
        user_agent: r.user_agent ?? "",
      };
    });

    const filename = `sessoes_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    downloadCsvWithHeaders(filename, headers, exportRows);
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
        <h1 className="text-lg font-semibold text-slate-900">Sessões</h1>
        <p className="mt-2 text-sm text-slate-700">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Sessões</h1>
            <p className="mt-1 text-sm text-slate-600">
              Online agora, último acesso, dispositivo e motivo de logout.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportCsv}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Exportar CSV
            </button>

            <button
              onClick={fetchSessions}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Online (lista atual)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.online}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Logouts por idle (lista atual)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.idle}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Logouts manuais (lista atual)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.manual}</p>
          </div>
        </div>
      </div>

      {/* Filters + table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Modo</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SessionMode)}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="online">Online agora</option>
              <option value="all">Todas</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Logout</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as SessionReasonFilter)}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="manual">Manual</option>
              <option value="idle">Idle</option>
              <option value="token_expired">Token exp.</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Departamento</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              {departmentOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[260px] flex-1">
            <label className="block text-xs font-semibold text-slate-700">Buscar (nome ou e-mail)</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex.: Maria / @solida.com"
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
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
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
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Usuário</th>
                <th className="px-4 py-3 font-semibold">Dispositivo</th>
                <th className="px-4 py-3 font-semibold">Login</th>
                <th className="px-4 py-3 font-semibold">Último acesso</th>
                <th className="px-4 py-3 font-semibold">Logout</th>
                <th className="px-4 py-3 font-semibold">Motivo</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={7}>
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={7}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const st = getOnlineStatus(r.last_seen_at, r.logout_at);
                  const ua = simplifyUA(r.user_agent);

                  return (
                    <tr key={r.id} className="bg-white">
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                            st.online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700",
                          ].join(" ")}
                          title={`Último acesso: ${toLocal(r.last_seen_at)}`}
                        >
                          {st.online ? "Online" : "Offline"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">{r.full_name ?? "—"}</span>
                          <span className="text-xs text-slate-600">{r.email ?? r.user_id}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-800">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">{ua.browser}</span>
                          <span className="text-xs text-slate-600">{ua.device}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-800">{toLocal(r.login_at)}</td>

                      <td className="px-4 py-3 text-slate-800">
                        {toLocal(r.last_seen_at)} <span className="text-slate-500">({st.ageText})</span>
                      </td>

                      <td className="px-4 py-3 text-slate-800">{toLocal(r.logout_at)}</td>

                      <td className="px-4 py-3 text-slate-800">{r.logout_reason ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          “Online agora” considera <b>logout_at vazio</b> e <b>last_seen_at</b> nos últimos {ONLINE_WINDOW_MINUTES} minutos.
          O CSV exporta exatamente o conjunto filtrado exibido (com cabeçalho mesmo sem dados).
        </p>
      </div>
    </div>
  );
}
