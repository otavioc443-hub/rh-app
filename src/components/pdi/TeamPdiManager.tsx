"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, RefreshCcw } from "lucide-react";

type PdiStatus = "planejado" | "em_andamento" | "concluido";

type TeamPdiItem = {
  id: string;
  user_id: string;
  title: string;
  action: string | null;
  target_date: string | null;
  status: PdiStatus;
  created_at: string;
};

type TeamRow = {
  user_id: string;
  collaborator_name: string;
  collaborator_email: string | null;
  items: TeamPdiItem[];
};

function statusLabel(status: PdiStatus) {
  if (status === "planejado") return "Planejado";
  if (status === "em_andamento") return "Em andamento";
  return "Concluido";
}

function statusClass(status: PdiStatus) {
  if (status === "concluido") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "em_andamento") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

type Props = {
  title: string;
  subtitle: string;
  compact?: boolean;
};

export default function TeamPdiManager({ title, subtitle, compact = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PdiStatus>("all");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/pdi/team", { method: "GET" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao carregar PDI da equipe.");
      setRows((json.rows ?? []) as TeamRow[]);
    } catch (e: unknown) {
      setRows([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar PDI da equipe.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const scoped = selectedUserId === "all" ? rows : rows.filter((r) => r.user_id === selectedUserId);
    return scoped
      .map((r) => ({
        ...r,
        items: statusFilter === "all" ? r.items : r.items.filter((i) => i.status === statusFilter),
      }))
      .filter((r) => r.items.length > 0 || statusFilter === "all");
  }, [rows, selectedUserId, statusFilter]);

  const stats = useMemo(() => {
    const allItems = rows.flatMap((r) => r.items);
    return {
      totalCollaborators: rows.length,
      totalItems: allItems.length,
      planned: allItems.filter((i) => i.status === "planejado").length,
      inProgress: allItems.filter((i) => i.status === "em_andamento").length,
      done: allItems.filter((i) => i.status === "concluido").length,
    };
  }, [rows]);

  async function setStatus(pdiId: string, status: PdiStatus) {
    setSavingId(pdiId);
    setMsg("");
    try {
      const res = await fetch("/api/pdi/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdi_id: pdiId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao atualizar status do PDI.");

      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          items: row.items.map((item) => (item.id === pdiId ? { ...item, status } : item)),
        }))
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar status do PDI.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className={`${compact ? "text-lg" : "text-xl"} font-semibold text-slate-900`}>{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Colaboradores</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{stats.totalCollaborators}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Itens PDI</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{stats.totalItems}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Planejado</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{stats.planned}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Em andamento</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{stats.inProgress}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Concluido</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{stats.done}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">
            Colaborador
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              {rows.map((r) => (
                <option key={r.user_id} value={r.user_id}>
                  {r.collaborator_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | PdiStatus)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="planejado">Planejado</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluido">Concluido</option>
            </select>
          </label>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">Carregando...</div>
          ) : filteredRows.length ? (
            filteredRows.map((row) => (
              <div key={row.user_id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">{row.collaborator_name}</p>
                <p className="text-xs text-slate-500">{row.collaborator_email ?? "Sem e-mail cadastrado"}</p>

                <div className="mt-3 space-y-2">
                  {row.items.length ? (
                    row.items.map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                            <p className="text-xs text-slate-600">{item.action || "Sem acao detalhada."}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Prazo: {item.target_date ? new Date(item.target_date).toLocaleDateString("pt-BR") : "-"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                              {statusLabel(item.status)}
                            </span>
                            <button
                              onClick={() => void setStatus(item.id, "em_andamento")}
                              disabled={savingId === item.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-60"
                            >
                              <Clock3 size={14} />
                              Em andamento
                            </button>
                            <button
                              onClick={() => void setStatus(item.id, "concluido")}
                              disabled={savingId === item.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                            >
                              <CheckCircle2 size={14} />
                              Concluir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">
                      Nenhum item para o filtro atual.
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhum PDI de equipe encontrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
