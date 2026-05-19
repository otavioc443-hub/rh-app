"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, RefreshCcw, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

type Person = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  company_id: string | null;
};

type AuditMessage = {
  id: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  text: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function AdminAuditMessagesPage() {
  const { loading: roleLoading, role } = useUserRole();
  const canAccess = role === "admin";
  const [people, setPeople] = useState<Person[]>([]);
  const [messages, setMessages] = useState<AuditMessage[]>([]);
  const [senderId, setSenderId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextSenderId = senderId, nextReceiverId = receiverId) {
    if (!canAccess) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (nextSenderId) params.set("senderId", nextSenderId);
      if (nextReceiverId) params.set("receiverId", nextReceiverId);
      params.set("limit", String(limit));
      const res = await fetch(`/api/admin/audit/messages?${params.toString()}`, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        people?: Person[];
        messages?: AuditMessage[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar auditoria.");
      setPeople(json.people ?? []);
      setMessages(json.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar auditoria.");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!roleLoading) void load("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, canAccess]);

  const peopleOptions = useMemo(() => {
    const term = normalize(search.trim());
    const base = people.filter((person) => {
      if (!term) return true;
      return normalize(`${person.name} ${person.email ?? ""} ${person.role ?? ""}`).includes(term);
    });
    return base.sort((a, b) => a.name.localeCompare(b.name));
  }, [people, search]);

  const selectedSender = people.find((person) => person.id === senderId) ?? null;
  const selectedReceiver = people.find((person) => person.id === receiverId) ?? null;

  if (roleLoading || loading) {
    return <div className="p-6 text-sm text-slate-600">Carregando auditoria de mensagens...</div>;
  }

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
        Apenas administradores podem acessar a auditoria de mensagens.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <MessageSquareText size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Auditoria de mensagens</h1>
              <p className="mt-1 text-sm text-slate-600">
                Consulte conversas diretas do PulseHub somente para verificações administrativas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={16} /> Atualizar
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_120px]">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Remetente
            <select
              value={senderId}
              onChange={(event) => setSenderId(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal"
            >
              <option value="">Selecione</option>
              {peopleOptions.map((person) => (
                <option key={`sender-${person.id}`} value={person.id} disabled={person.id === receiverId}>
                  {person.name} {person.email ? `- ${person.email}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Receptor
            <select
              value={receiverId}
              onChange={(event) => setReceiverId(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal"
            >
              <option value="">Selecione</option>
              {peopleOptions.map((person) => (
                <option key={`receiver-${person.id}`} value={person.id} disabled={person.id === senderId}>
                  {person.name} {person.email ? `- ${person.email}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Limite
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[260px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrar colaboradores por nome, e-mail ou perfil"
              className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={!senderId || !receiverId || senderId === receiverId}
            onClick={() => void load()}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Consultar conversa
          </button>
        </div>
        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Resultado da auditoria</h2>
            <p className="mt-1 text-sm text-slate-600">
              {selectedSender && selectedReceiver
                ? `${selectedSender.name} x ${selectedReceiver.name}`
                : "Selecione remetente e receptor para visualizar o histórico."}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {messages.length} mensagem(ns)
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {messages.length ? (
            messages.map((message) => {
              const isSender = message.from_user_id === senderId;
              return (
                <div
                  key={message.id}
                  className={`rounded-2xl border p-4 ${
                    isSender ? "border-blue-100 bg-blue-50/60" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-950">
                      {message.from_name} para {message.to_name}
                    </p>
                    <span className="text-xs font-semibold text-slate-500">{formatDate(message.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.text}</p>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Nenhuma mensagem encontrada para os filtros selecionados.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
