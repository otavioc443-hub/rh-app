"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { NotificationRow } from "@/lib/absence";

type FilterMode = "all" | "unread";
type ActionFilter = "all" | "action";
type SeverityFilter = "all" | "info" | "success" | "warning" | "critical";

const CATEGORY_LABEL: Record<string, string> = {
  ausencias: "Ausencias",
  lms: "LMS",
  financeiro: "Financeiro",
  comunicados: "Comunicados",
  projetos: "Projetos",
  desenvolvimento: "Desenvolvimento",
  mapa: "Mapa",
  privacidade: "Privacidade",
  etica: "Etica",
  chamados: "Chamados",
  geral: "Geral",
};

function severityClass(severity: string | null | undefined) {
  if (severity === "critical") return "bg-rose-100 text-rose-700";
  if (severity === "warning") return "bg-amber-100 text-amber-700";
  if (severity === "success") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function severityLabel(severity: string | null | undefined) {
  if (severity === "critical") return "Critica";
  if (severity === "warning") return "Atencao";
  if (severity === "success") return "Concluida";
  return "Informativa";
}

export default function NotificacoesPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const unreadCount = useMemo(() => items.filter((x) => !x.read_at).length, [items]);
  const actionCount = useMemo(() => items.filter((x) => x.action_required && !x.read_at).length, [items]);
  const categories = useMemo(() => {
    const values = Array.from(new Set(items.map((x) => x.category || "geral")));
    return values.sort((a, b) => (CATEGORY_LABEL[a] ?? a).localeCompare(CATEGORY_LABEL[b] ?? b, "pt-BR"));
  }, [items]);
  const visibleItems = useMemo(() => {
    return items.filter((x) => {
      if (filter === "unread" && x.read_at) return false;
      if (categoryFilter !== "all" && (x.category || "geral") !== categoryFilter) return false;
      if (actionFilter === "action" && !x.action_required) return false;
      if (severityFilter !== "all" && (x.severity || "info") !== severityFilter) return false;
      return true;
    });
  }, [actionFilter, categoryFilter, filter, items, severityFilter]);

  async function load() {
    setLoading(true);
    setMsg("");
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user?.id ?? null;
    let query = supabase
      .from("notifications")
      .select("id,to_user_id,title,body,link,type,category,severity,action_required,entity_type,entity_id,data,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(120);
    if (currentUserId) query = query.eq("to_user_id", currentUserId);
    const { data, error } = await query;

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }
    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function markRead(id: string) {
    const now = new Date().toISOString();
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read_at: now } : x)));
    }
  }

  async function markAllRead() {
    const unreadIds = visibleItems.filter((x) => !x.read_at).map((x) => x.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: unreadIds,
        filter: {
          unreadOnly: true,
          category: categoryFilter,
          severity: severityFilter,
          actionRequired: actionFilter === "action",
        },
      }),
    });
    if (res.ok) {
      const unreadSet = new Set(unreadIds);
      setItems((prev) => prev.map((x) => (unreadSet.has(x.id) ? { ...x, read_at: now } : x)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Notificacoes</h1>
            <p className="mt-1 text-sm text-slate-600">Aprovacoes, solicitacoes e atualizacoes importantes do portal.</p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {items.length} no historico recente · {unreadCount} nao lida(s) · {actionCount} exigem acao
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${filter === "all" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"}`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${filter === "unread" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700"}`}
            >
              Nao lidas ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActionFilter((current) => (current === "action" ? "all" : "action"))}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${actionFilter === "action" ? "bg-amber-600 text-white" : "border border-slate-200 text-slate-700"}`}
            >
              Exigem acao ({actionCount})
            </button>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={visibleItems.filter((x) => !x.read_at).length === 0}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Marcar filtro como lido
            </button>
          </div>
        </div>
      </div>

      {msg ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Categoria
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category] ?? category}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Severidade
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todas</option>
              <option value="info">Informativa</option>
              <option value="success">Concluida</option>
              <option value="warning">Atencao</option>
              <option value="critical">Critica</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setCategoryFilter("all");
              setActionFilter("all");
              setSeverityFilter("all");
            }}
            className="self-end rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-2">
          {loading ? <div className="text-sm text-slate-600">Carregando notificacoes...</div> : null}

          {!loading && visibleItems.length === 0 ? (
            <div className="text-sm text-slate-600">Sem notificacoes para este filtro.</div>
          ) : null}

          {!loading
            ? visibleItems.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl border p-4 ${n.read_at ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50/40"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">{n.title}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          {CATEGORY_LABEL[n.category || "geral"] ?? n.category ?? "Geral"}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${severityClass(n.severity)}`}>
                          {severityLabel(n.severity)}
                        </span>
                        {n.action_required ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                            Exige acao
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{n.body}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(n.created_at).toLocaleString("pt-BR")}</div>

                      <div className="mt-2 flex items-center gap-3">
                        {n.link ? (
                          <Link
                            className="inline-block text-sm font-semibold text-slate-900 underline"
                            href={n.link}
                            onClick={() => {
                              if (!n.read_at) {
                                void markRead(n.id);
                              }
                            }}
                          >
                            Abrir
                          </Link>
                        ) : null}
                        {!n.read_at ? (
                          <button
                            type="button"
                            onClick={() => void markRead(n.id)}
                            className="text-sm font-semibold text-slate-700 hover:underline"
                          >
                            Marcar como lida
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-xs">
                      {n.read_at ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Lida</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Nova</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
