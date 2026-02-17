"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { NotificationRow } from "@/lib/absence";

const PREVIEW_LIMIT = 6;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [msg, setMsg] = useState("");
  const [newIndicator, setNewIndicator] = useState(false);
  const [quickAlert, setQuickAlert] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const interactedRef = useRef(false);
  const indicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = useMemo(() => items.filter((x) => !x.read_at).length, [items]);

  function playNotificationSound() {
    if (typeof window === "undefined" || !interactedRef.current) return;
    try {
      const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.02;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
      osc.onended = () => {
        void ctx.close();
      };
    } catch {
      // Som e opcional; falhas sao ignoradas.
    }
  }

  function triggerNewNotificationFeedback() {
    setNewIndicator(true);
    setQuickAlert("Nova notificacao recebida");
    playNotificationSound();

    if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);

    indicatorTimeoutRef.current = setTimeout(() => setNewIndicator(false), 1800);
    alertTimeoutRef.current = setTimeout(() => setQuickAlert(""), 2600);
  }

  async function load(emitFeedback = false) {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase
      .from("notifications")
      .select("id,to_user_id,title,body,link,type,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(PREVIEW_LIMIT);

    if (error) {
      setMsg("Erro ao carregar notificacoes.");
      setLoading(false);
      return;
    }

    const nextItems = (data ?? []) as NotificationRow[];
    const nextIds = new Set(nextItems.map((x) => x.id));
    const hasNew = !firstLoadRef.current && nextItems.some((x) => !knownIdsRef.current.has(x.id));

    knownIdsRef.current = nextIds;
    firstLoadRef.current = false;
    setItems(nextItems);

    if (emitFeedback && hasNew) {
      triggerNewNotificationFeedback();
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    let cleanupRequested = false;

    async function subscribeRealtime() {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!alive || !userId) return;

      const channel = supabase
        .channel(`notifications-bell-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `to_user_id=eq.${userId}`,
          },
          () => {
            void load(true);
          }
        )
        .subscribe();

      return channel;
    }

    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    void subscribeRealtime().then((ch) => {
      if (!ch) return;
      if (cleanupRequested) {
        void supabase.removeChannel(ch);
        return;
      }
      realtimeChannel = ch;
    });

    return () => {
      alive = false;
      cleanupRequested = true;
      if (realtimeChannel) {
        void supabase.removeChannel(realtimeChannel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onUserInteraction() {
      interactedRef.current = true;
    }
    window.addEventListener("pointerdown", onUserInteraction, { once: true });
    window.addEventListener("keydown", onUserInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
    };
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, []);

  async function markAsRead(id: string) {
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) return;
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read_at: new Date().toISOString() } : x)));
  }

  return (
    <div className="relative" ref={rootRef}>
      {quickAlert ? (
        <div className="absolute right-0 top-[-40px] z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {quickAlert}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuickAlert("");
          setNewIndicator(false);
          if (!open) {
            void load();
          }
        }}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${newIndicator ? "animate-pulse ring-2 ring-emerald-300" : ""}`}
        aria-label="Notificacoes"
      >
        <Megaphone size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notificacoes</p>
            <Link href="/notificacoes" className="text-xs font-semibold text-slate-700 hover:underline" onClick={() => setOpen(false)}>
              Ver todas
            </Link>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {loading ? <p className="px-2 py-3 text-sm text-slate-500">Carregando...</p> : null}
            {!loading && msg ? <p className="px-2 py-3 text-sm text-rose-700">{msg}</p> : null}
            {!loading && !msg && items.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">Sem notificacoes recentes.</p>
            ) : null}

            {!loading && !msg
              ? items.map((n) => (
                  <div key={n.id} className="mb-2 rounded-xl border border-slate-100 bg-slate-50 p-3 last:mb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900">{n.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-700">{n.body}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                        <div className="mt-2 flex items-center gap-3">
                          {n.link ? (
                            <Link
                              href={n.link}
                              onClick={() => setOpen(false)}
                              className="text-xs font-semibold text-slate-900 underline"
                            >
                              Abrir
                            </Link>
                          ) : null}
                          {!n.read_at ? (
                            <button
                              type="button"
                              onClick={() => void markAsRead(n.id)}
                              className="text-xs font-semibold text-slate-700 hover:underline"
                            >
                              Marcar lida
                            </button>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">Lida</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
