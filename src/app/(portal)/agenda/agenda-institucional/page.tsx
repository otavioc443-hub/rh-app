"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "admin";

type InstitutionalEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  visibility: string;
  created_by: string | null;
  created_at: string;
};

export default function AgendaInstitucionalPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [events, setEvents] = useState<InstitutionalEvent[]>([]);
  const [role, setRole] = useState<Role | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const isSetupHint = msg.toLowerCase().includes("supabase/sql/");

  const canManage = role === "admin" || role === "rh";

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        setEvents([]);
        setRole(null);
        setMsg("Sessao invalida. Faca login novamente.");
        return;
      }

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<{ role: Role | null }>();
      if (pErr) throw pErr;
      setRole((p?.role ?? null) as Role | null);

      const { data, error } = await supabase
        .from("institutional_events")
        .select("id,title,description,event_date,visibility,created_by,created_at")
        .gte("event_date", new Date().toISOString().slice(0, 10))
        .order("event_date", { ascending: true });
      if (error) throw error;

      setEvents((data ?? []) as InstitutionalEvent[]);
    } catch (e: unknown) {
      setEvents([]);
      const text = e instanceof Error ? e.message : "Erro ao carregar agenda institucional.";
      setMsg(
        `Erro ao carregar agenda institucional: ${text}. Rode supabase/sql/2026-02-11_create_institutional_events.sql se a tabela nao existir.`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const monthGroups = useMemo(() => {
    const map = new Map<string, InstitutionalEvent[]>();
    for (const ev of events) {
      const d = new Date(`${ev.event_date}T00:00:00`);
      const key = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [events]);

  async function createEvent() {
    if (!canManage) return;
    if (!title.trim() || !eventDate) {
      setMsg("Informe titulo e data do evento.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      const { error } = await supabase.from("institutional_events").insert({
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        visibility: "all",
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      setTitle("");
      setDescription("");
      setEventDate("");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar evento.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(id: string) {
    if (!canManage) return;
    const ok = window.confirm("Excluir este evento institucional?");
    if (!ok) return;
    setMsg("");
    try {
      const { error } = await supabase.from("institutional_events").delete().eq("id", id);
      if (error) throw error;
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir evento.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Agenda institucional</h1>
            <p className="mt-1 text-sm text-slate-600">
              Eventos e datas importantes da organizacao.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {canManage ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Novo evento</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titulo do evento"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
            <button
              onClick={() => void createEvent()}
              disabled={saving || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              <Plus size={16} />
              {saving ? "Salvando..." : "Adicionar"}
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descricao (opcional)"
            className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-300"
          />
        </div>
      ) : null}

      {msg ? (
        <div
          className={[
            "rounded-2xl border p-4 text-sm",
            isSetupHint ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700",
          ].join(" ")}
        >
          {msg}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Proximos eventos</p>
        <div className="mt-4 space-y-5">
          {monthGroups.length ? (
            monthGroups.map(([month, items]) => (
              <div key={month}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{month}</p>
                <div className="space-y-2">
                  {items.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{ev.title}</p>
                        <p className="text-sm text-slate-600">
                          {ev.description || "Sem descricao"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          <CalendarDays size={14} />
                          {new Date(`${ev.event_date}T00:00:00`).toLocaleDateString("pt-BR")}
                        </span>
                        {canManage ? (
                          <button
                            onClick={() => void removeEvent(ev.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhum evento institucional futuro cadastrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
