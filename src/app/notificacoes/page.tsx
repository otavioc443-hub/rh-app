"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { NotificationRow } from "@/lib/absence";

export default function NotificacoesPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setMsg(error.message);
      return;
    }
    setItems((data as any) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (!error) load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificações</h1>
        <p className="text-sm text-slate-600">Aprovações, solicitações e atualizações do portal.</p>
      </div>

      {msg ? <div className="rounded-xl border bg-white p-4 text-sm">{msg}</div> : null}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-sm text-slate-600">Sem notificações por enquanto.</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="mt-1 text-sm text-slate-700">{n.body}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </div>

                    {n.link ? (
                      <a className="mt-2 inline-block text-sm text-slate-900 underline" href={n.link}>
                        Abrir
                      </a>
                    ) : null}
                  </div>

                  <div className="text-xs">
                    {n.read_at ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1">Lida</span>
                    ) : (
                      <button
                        onClick={() => markRead(n.id)}
                        className="rounded-xl border px-3 py-2 hover:bg-slate-50"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
