"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { NotificationRow } from "@/lib/absence";

type FilterMode = "all" | "unread";

export default function NotificacoesPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");

  const unreadCount = useMemo(() => items.filter((x) => !x.read_at).length, [items]);
  const visibleItems = useMemo(
    () => (filter === "unread" ? items.filter((x) => !x.read_at) : items),
    [filter, items]
  );

  async function load() {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase
      .from("notifications")
      .select("id,to_user_id,title,body,link,type,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(120);

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
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
  }

  async function markAllRead() {
    const unreadIds = items.filter((x) => !x.read_at).map((x) => x.id);
    if (!unreadIds.length) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
    if (!error) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Notificacoes</h1>
            <p className="mt-1 text-sm text-slate-600">Aprovacoes, solicitacoes e atualizacoes importantes do portal.</p>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Marcar todas como lidas
            </button>
          </div>
        </div>
      </div>

      {msg ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{msg}</div> : null}

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
