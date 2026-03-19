"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type TicketType =
  | "solidarvt"
  | "solides"
  | "server_access"
  | "equipment"
  | "system_improvement"
  | "other";

type TicketPriority = "low" | "medium" | "high" | "critical";
type TicketStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "cancelled";

type TicketRow = {
  id: string;
  requester_user_id: string;
  requester_role: string | null;
  title: string;
  request_type: TicketType;
  priority: TicketPriority;
  description: string;
  status: TicketStatus;
  assigned_to: string | null;
  resolution_notes: string | null;
  opened_at: string;
  due_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

function extractAttachment(description: string) {
  const match = description.match(/(?:^|\n)Anexo:\s*(\S+)/i);
  const raw = match?.[1]?.trim() ?? "";
  const cleanDescription = description.replace(/\n?Anexo:\s*\S+/gi, "").trim();
  if (!raw) return { cleanDescription, attachmentPath: null, attachmentUrl: null };
  if (/^https?:\/\//i.test(raw)) return { cleanDescription, attachmentPath: null, attachmentUrl: raw };
  return { cleanDescription, attachmentPath: raw, attachmentUrl: null };
}

function typeLabel(value: TicketType) {
  if (value === "server_access") return "TI - Acessos e infraestrutura";
  if (value === "system_improvement") return "Sistemas internos";
  if (value === "equipment") return "Equipamentos (computador e perifericos)";
  if (value === "solidarvt" || value === "solides") return "Sistemas internos";
  return "Outros de TI";
}

function statusLabel(value: TicketStatus) {
  if (value === "open") return "Aberto";
  if (value === "in_progress") return "Em andamento";
  if (value === "waiting_user") return "Aguardando usuario";
  if (value === "resolved") return "Resolvido";
  return "Cancelado";
}

function statusClass(value: TicketStatus) {
  if (value === "open") return "bg-amber-50 text-amber-700";
  if (value === "in_progress") return "bg-sky-50 text-sky-700";
  if (value === "waiting_user") return "bg-violet-50 text-violet-700";
  if (value === "resolved") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function priorityLabel(value: TicketPriority) {
  if (value === "low") return "Baixa";
  if (value === "medium") return "Media";
  if (value === "high") return "Alta";
  return "Critica";
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("pt-BR");
}

export default function PdChamadosPage() {
  const { role } = useUserRole();
  const isSupport = role === "admin" || role === "rh" || role === "financeiro" || role === "gestor" || role === "pd";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [selectedId, setSelectedId] = useState("");

  const [formType, setFormType] = useState<TicketType>("system_improvement");
  const [formPriority, setFormPriority] = useState<TicketPriority>("medium");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const [decisionStatus, setDecisionStatus] = useState<TicketStatus>("in_progress");
  const [decisionAssignedTo, setDecisionAssignedTo] = useState<string>("");
  const [decisionNotes, setDecisionNotes] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setUserId(authData.user.id);

      const query = supabase
        .from("pd_tickets")
        .select(
          "id,requester_user_id,requester_role,title,request_type,priority,description,status,assigned_to,resolution_notes,opened_at,due_at,resolved_at,created_at,updated_at"
        )
        .order("created_at", { ascending: false });
      if (!isSupport) query.eq("requester_user_id", authData.user.id);

      const ticketsRes = await query;
      if (ticketsRes.error) throw new Error(ticketsRes.error.message);

      const tickets = (ticketsRes.data ?? []) as TicketRow[];
      setRows(tickets);
      setSelectedId((prev) => (prev && tickets.some((r) => r.id === prev) ? prev : tickets[0]?.id ?? ""));

      const userIds = Array.from(
        new Set(
          tickets
            .flatMap((x) => [x.requester_user_id, x.assigned_to ?? ""])
            .filter(Boolean)
        )
      );

      if (isSupport && authData.user.id) userIds.push(authData.user.id);

      if (userIds.length) {
        const { data: profileRows, error: profileErr } = await supabase
          .from("profiles")
          .select("id,full_name,email,role")
          .in("id", Array.from(new Set(userIds)));
        if (profileErr) throw new Error(profileErr.message);

        const map: Record<string, ProfileRow> = {};
        for (const p of (profileRows ?? []) as ProfileRow[]) map[p.id] = p;
        setProfiles(map);
      } else {
        setProfiles({});
      }
    } catch (e: unknown) {
      setRows([]);
      setProfiles({});
      setSelectedId("");
      setMsg(e instanceof Error ? e.message : "Erro ao carregar chamados P&D.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!role) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, isSupport]);

  const selected = useMemo(() => rows.find((x) => x.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setDecisionStatus(selected.status);
    setDecisionAssignedTo(selected.assigned_to ?? "");
    setDecisionNotes(selected.resolution_notes ?? "");
  }, [selected]);

  const supportOptions = useMemo(
    () =>
      Object.values(profiles)
        .filter((p) => ["admin", "rh", "financeiro", "gestor", "pd"].includes(String(p.role ?? "")))
        .sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "", "pt-BR")),
    [profiles]
  );

  async function createTicket() {
    if (!userId) return;
    const title = formTitle.trim();
    const description = formDescription.trim();
    if (!title || !description) {
      setMsg("Preencha titulo e descricao do chamado.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase.from("pd_tickets").insert({
        requester_user_id: userId,
        requester_role: role ?? null,
        title,
        request_type: formType,
        priority: formPriority,
        description,
      });
      if (error) throw new Error(error.message);

      setFormTitle("");
      setFormDescription("");
      setFormPriority("medium");
      setFormType("system_improvement");
      setMsg("Chamado registrado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar chamado.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTicket() {
    if (!selected || !isSupport) return;
    setSaving(true);
    setMsg("");
    try {
      const patch: Record<string, unknown> = {
        status: decisionStatus,
        assigned_to: decisionAssignedTo || null,
        resolution_notes: decisionNotes.trim() || null,
      };
      if (decisionStatus === "resolved") patch.resolved_at = new Date().toISOString();
      if (decisionStatus !== "resolved") patch.resolved_at = null;

      const { error } = await supabase.from("pd_tickets").update(patch).eq("id", selected.id);
      if (error) throw new Error(error.message);

      setMsg("Chamado atualizado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar chamado.");
    } finally {
      setSaving(false);
    }
  }

  async function openAttachment(ticket: TicketRow) {
    setMsg("");
    try {
      const parsed = extractAttachment(ticket.description);
      if (parsed.attachmentPath) {
        const res = await fetch("/api/chamados/attachments/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: ticket.id,
            path: parsed.attachmentPath,
            source: "pd_ticket",
          }),
        });
        const json = (await res.json()) as { signedUrl?: string; error?: string };
        if (!res.ok || !json.signedUrl) throw new Error(json.error ?? "Nao foi possivel abrir o anexo.");
        window.open(json.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (parsed.attachmentUrl) {
        window.open(parsed.attachmentUrl, "_blank", "noopener,noreferrer");
        return;
      }
      throw new Error("Anexo indisponivel.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir anexo.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">P&D - Chamados de sistema e infraestrutura</h1>
            <p className="mt-1 text-sm text-slate-600">
              Acompanhe demandas de SolidaRVT, Solides, acessos ao servidor, equipamentos e melhorias de sistema.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Abrir chamado P&D</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Sistema/assunto
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as TicketType)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="server_access">TI - Acessos e infraestrutura</option>
              <option value="system_improvement">Sistemas internos</option>
              <option value="equipment">Equipamentos (computador e perifericos)</option>
              <option value="other">Outros de TI</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Prioridade
            <select
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value as TicketPriority)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="low">Baixa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            Titulo do chamado
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              placeholder="Ex.: Liberar acesso VPN para Solides"
            />
          </label>
        </div>

        <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-700">
          Descricao
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            className="min-h-[110px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
            placeholder="Descreva o problema, impacto e o que precisa ser feito."
          />
        </label>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => void createTicket()}
            disabled={saving || loading}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Registrar chamado"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="p-3">Chamado</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Solicitante</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Abertura</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={6}>Carregando...</td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row) => {
                    const requester = profiles[row.requester_user_id];
                    const requesterLabel = requester?.full_name || requester?.email || row.requester_user_id;
                    const parsed = extractAttachment(row.description);
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-t ${selectedId === row.id ? "bg-slate-50" : "hover:bg-slate-50"}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="p-3">
                          <p className="font-semibold text-slate-900">{row.title}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-600">{parsed.cleanDescription}</p>
                        </td>
                        <td className="p-3">{typeLabel(row.request_type)}</td>
                        <td className="p-3">{priorityLabel(row.priority)}</td>
                        <td className="p-3">{requesterLabel}</td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="p-3">{fmtDate(row.opened_at)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={6}>Nenhum chamado encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Wrench size={16} />
            Detalhes do chamado
          </div>

          {selected ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                {(() => {
                  const parsed = extractAttachment(selected.description);
                  return (
                    <>
                <p className="font-semibold text-slate-900">{selected.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{parsed.cleanDescription}</p>
                {parsed.attachmentPath || parsed.attachmentUrl ? (
                  <button
                    type="button"
                    onClick={() => void openAttachment(selected)}
                    className="mt-2 text-xs font-semibold text-sky-700 underline"
                  >
                    Ver anexo
                  </button>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  Tipo: {typeLabel(selected.request_type)} | Prioridade: {priorityLabel(selected.priority)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Aberto em: {fmtDate(selected.opened_at)} | Resolvido em: {fmtDate(selected.resolved_at)}
                </p>
                    </>
                  );
                })()}
              </div>

              {isSupport ? (
                <>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Status
                    <select
                      value={decisionStatus}
                      onChange={(e) => setDecisionStatus(e.target.value as TicketStatus)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="open">Aberto</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="waiting_user">Aguardando usuario</option>
                      <option value="resolved">Resolvido</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Responsavel
                    <select
                      value={decisionAssignedTo}
                      onChange={(e) => setDecisionAssignedTo(e.target.value)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="">Nao atribuido</option>
                      {supportOptions.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.full_name || person.email || person.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Notas tecnicas / resolucao
                    <textarea
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      className="min-h-[100px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void updateTicket()}
                    disabled={saving}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Atualizar chamado"}
                  </button>
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                  Acompanhamento em modo consulta. O time de P&D atualiza status e responsavel.
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Selecione um chamado para visualizar os detalhes.</p>
          )}
        </div>
      </div>
    </div>
  );
}

