"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";

type LogoutReason = "manual" | "idle" | "token_expired" | "page_exit" | null;
type SessionReasonFilter = "all" | "manual" | "idle" | "token_expired" | "page_exit";
type SessionRoleFilter = "all" | "admin" | "rh" | "gestor" | "coordenador" | "colaborador";
type QuickViewFilter = "all" | "online" | "ended";
type SortKey = "last_seen_at" | "login_at" | "logout_reason";
type SortDirection = "asc" | "desc";
const PAGE_SIZE = 20;

type SessionRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  department_id: string | null;
  department_name?: string | null;
  login_at: string;
  last_seen_at: string;
  logout_at: string | null;
  logout_reason: LogoutReason;
  user_agent: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

const ONLINE_WINDOW_MINUTES = 2;

function toLocal(dt: string | null) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("pt-BR");
}

function minutesAgo(dt: string) {
  const diffMs = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m <= 0) return "agora";
  if (m === 1) return "1 min atras";
  return `${m} min atras`;
}

function getOnlineStatus(lastSeen: string, logoutAt: string | null) {
  const lastSeenMs = new Date(lastSeen).getTime();
  const online = !logoutAt && lastSeenMs >= Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000;
  const ageText = minutesAgo(lastSeen);
  return { online, ageText };
}

function simplifyUA(ua: string | null) {
  if (!ua) return { browser: "-", device: "-" };

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

function formatLogoutReason(reason: LogoutReason) {
  if (reason === "manual") return "Manual";
  if (reason === "idle") return "Idle";
  if (reason === "token_expired") return "Token exp.";
  if (reason === "page_exit") return "Saida real";
  return "-";
}

function logoutReasonBadgeClass(reason: LogoutReason) {
  if (reason === "manual") return "bg-slate-100 text-slate-700";
  if (reason === "idle") return "bg-amber-50 text-amber-700";
  if (reason === "token_expired") return "bg-rose-50 text-rose-700";
  if (reason === "page_exit") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-500";
}

function escapeCsv(value: unknown) {
  const str = String(value ?? "");
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

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

  const [reason, setReason] = useState<SessionReasonFilter>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [departmentId, setDepartmentId] = useState<"all" | string>("all");
  const [roleFilter, setRoleFilter] = useState<SessionRoleFilter>("all");
  const [quickView, setQuickView] = useState<QuickViewFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("last_seen_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  async function fetchSessions() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        reason,
        departmentId,
        role: roleFilter,
        search: search.trim(),
        limit: String(limit),
      });

      const res = await fetch(`/api/admin/sessions?${params.toString()}`, { method: "GET" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Erro ao carregar sessoes.");

      setRows((payload?.rows ?? []) as SessionRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar sessoes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    fetchSessions();
    const t = setInterval(fetchSessions, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, reason, limit, departmentId, roleFilter]);

  useEffect(() => {
    if (!canView) return;
    const t = setTimeout(fetchSessions, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.department_id) map.set(r.department_id, r.department_name?.trim() || r.department_id);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      const st = getOnlineStatus(r.last_seen_at, r.logout_at);
      if (quickView === "online") return st.online;
      if (quickView === "ended") return !!r.logout_at;
      return true;
    });
  }, [quickView, rows]);

  const sortedVisibleRows = useMemo(() => {
    const reasonOrder: Record<string, number> = {
      manual: 1,
      idle: 2,
      page_exit: 3,
      token_expired: 4,
      "": 5,
    };

    const factor = sortDirection === "asc" ? 1 : -1;
    return [...visibleRows].sort((a, b) => {
      let compare = 0;
      if (sortKey === "logout_reason") {
        compare =
          (reasonOrder[a.logout_reason ?? ""] ?? 99) -
          (reasonOrder[b.logout_reason ?? ""] ?? 99);
      } else {
        const ta = Date.parse(a[sortKey] ?? "");
        const tb = Date.parse(b[sortKey] ?? "");
        compare = (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
      }
      if (compare === 0) {
        const fallbackA = Date.parse(a.last_seen_at ?? a.login_at ?? "");
        const fallbackB = Date.parse(b.last_seen_at ?? b.login_at ?? "");
        compare = (Number.isFinite(fallbackA) ? fallbackA : 0) - (Number.isFinite(fallbackB) ? fallbackB : 0);
      }
      return compare * factor;
    });
  }, [sortDirection, sortKey, visibleRows]);

  const totalPages = Math.max(1, Math.ceil(sortedVisibleRows.length / PAGE_SIZE));

  const pagedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedVisibleRows.slice(start, start + PAGE_SIZE);
  }, [page, sortedVisibleRows, totalPages]);

  const quickViewCounts = useMemo(() => {
    const online = rows.filter((r) => getOnlineStatus(r.last_seen_at, r.logout_at).online).length;
    const ended = rows.filter((r) => !!r.logout_at).length;
    return {
      all: rows.length,
      online,
      ended,
    };
  }, [rows]);

  const stats = useMemo(() => {
    const online = visibleRows.filter((r) => getOnlineStatus(r.last_seen_at, r.logout_at).online).length;
    const uniqueUsers = new Set(visibleRows.map((r) => r.user_id)).size;
    const idle = visibleRows.filter((r) => r.logout_reason === "idle").length;
    const manual = visibleRows.filter((r) => r.logout_reason === "manual").length;
    const pageExit = visibleRows.filter((r) => r.logout_reason === "page_exit").length;
    return { online, uniqueUsers, idle, manual, pageExit };
  }, [visibleRows]);

  function handleExportCsv() {
    const headers = [
      "status",
      "nome",
      "email",
      "role",
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

    const exportRows = sortedVisibleRows.map((r) => {
      const st = getOnlineStatus(r.last_seen_at, r.logout_at);
      const ua = simplifyUA(r.user_agent);

      return {
        status: st.online ? "Online" : "Offline",
        nome: r.full_name ?? "",
        email: r.email ?? "",
        role: r.role ?? "",
        user_id: r.user_id,
        department_id: r.department_id ?? "",
        department_name: r.department_name ?? "",
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

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "logout_reason" ? "asc" : "desc");
    setPage(1);
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  useEffect(() => {
    setPage(1);
  }, [quickView, reason, departmentId, roleFilter, search, limit]);

  useEffect(() => {
    if (page <= totalPages) return;
    setPage(totalPages);
  }, [page, totalPages]);

  if (roleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Carregando permissoes...</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Sessoes</h1>
        <p className="mt-2 text-sm text-slate-700">Voce nao tem permissao para acessar esta pagina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Sessoes</h1>
            <p className="mt-1 text-sm text-slate-600">Online agora, ultimo acesso, dispositivo e motivo de logout.</p>
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
          <button
            type="button"
            onClick={() => setQuickView("online")}
            className={[
              "rounded-xl border p-4 text-left transition",
              quickView === "online" ? "border-emerald-300 bg-emerald-50/70" : "border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            <p className="text-xs text-slate-500">Online (lista atual)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.online}</p>
          </button>
          <button
            type="button"
            onClick={() => setQuickView("all")}
            className={[
              "rounded-xl border p-4 text-left transition",
              quickView === "all" ? "border-slate-400 bg-slate-50" : "border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            <p className="text-xs text-slate-500">Usuarios distintos (lista atual)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.uniqueUsers}</p>
          </button>
          <button
            type="button"
            onClick={() => setQuickView("ended")}
            className={[
              "rounded-xl border p-4 text-left transition",
              quickView === "ended" ? "border-blue-300 bg-blue-50/70" : "border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            <p className="text-xs text-slate-500">Logouts (idle / manual / saida real)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {stats.idle} / {stats.manual} / {stats.pageExit}
            </p>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end gap-3">
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
              <option value="page_exit">Saida real</option>
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
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Perfil</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as SessionRoleFilter)}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="admin">Admin</option>
              <option value="rh">RH</option>
              <option value="gestor">Gestor</option>
              <option value="coordenador">Coordenador</option>
              <option value="colaborador">Colaborador</option>
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

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "all", label: "Todas" },
            { id: "online", label: "Somente online" },
            { id: "ended", label: "Somente encerradas" },
          ].map((item) => {
            const active = quickView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setQuickView(item.id as QuickViewFilter)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {item.label} (
                {item.id === "all"
                  ? quickViewCounts.all
                  : item.id === "online"
                    ? quickViewCounts.online
                    : quickViewCounts.ended}
                )
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                    <th className="px-4 py-3 font-semibold">Perfil</th>
                    <th className="px-4 py-3 font-semibold">Dispositivo</th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("login_at")} className="inline-flex items-center gap-1">
                    Login
                    <span className="text-slate-400">{sortLabel("login_at")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("last_seen_at")} className="inline-flex items-center gap-1">
                    Ultimo acesso
                    <span className="text-slate-400">{sortLabel("last_seen_at")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">Logout</th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("logout_reason")} className="inline-flex items-center gap-1">
                    Motivo
                    <span className="text-slate-400">{sortLabel("logout_reason")}</span>
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={8}>
                    Carregando...
                  </td>
                </tr>
              ) : sortedVisibleRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={8}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => {
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
                          title={`Ultimo acesso: ${toLocal(r.last_seen_at)}`}
                        >
                          {st.online ? "Online" : "Offline"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">
                            {r.full_name?.trim() || r.email?.trim() || "Usuario"}
                          </span>
                          <span className="text-xs text-slate-600">{r.email ?? "E-mail nao informado"}</span>
                          {r.department_name ? (
                            <span className="text-xs text-slate-500">Departamento: {r.department_name}</span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-800">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {r.role ?? "colaborador"}
                        </span>
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

                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                            logoutReasonBadgeClass(r.logout_reason),
                          ].join(" ")}
                        >
                          {formatLogoutReason(r.logout_reason)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {sortedVisibleRows.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Exibindo {pagedRows.length} de {sortedVisibleRows.length} registros filtrados. Pagina {Math.min(page, totalPages)} de {totalPages}.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Proxima
              </button>
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-xs text-slate-500">
          &quot;Online agora&quot; considera <b>logout_at vazio</b> e <b>last_seen_at</b> nos ultimos {ONLINE_WINDOW_MINUTES} minutos.
          O CSV exporta exatamente o conjunto filtrado exibido (com cabecalho mesmo sem dados).
        </p>
      </div>
    </div>
  );
}

