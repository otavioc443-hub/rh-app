"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, CheckCircle2, Clock3, Trash2, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type PdiStatus = "planejado" | "em_andamento" | "concluido";

type PdiItem = {
  id: string;
  user_id: string;
  title: string;
  action: string | null;
  target_date: string | null;
  status: PdiStatus;
  created_at: string;
};

function statusLabel(status: PdiStatus) {
  if (status === "planejado") return "Planejado";
  if (status === "em_andamento") return "Em andamento";
  return "Concluido";
}

function statusClass(status: PdiStatus) {
  if (status === "concluido") return "bg-emerald-50 text-emerald-700";
  if (status === "em_andamento") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function PdiPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<PdiItem[]>([]);

  const [title, setTitle] = useState("");
  const [action, setAction] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const isSetupHint = msg.toLowerCase().includes("supabase/sql/");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        setUserId(null);
        setItems([]);
        setMsg("Sessao invalida. Faca login novamente.");
        return;
      }

      setUserId(user.id);
      const { data, error } = await supabase
        .from("pdi_items")
        .select("id,user_id,title,action,target_date,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      setItems((data ?? []) as PdiItem[]);
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : "Erro ao carregar PDI.";
      setMsg(
        `Erro ao carregar PDI: ${text}. Se a tabela ainda nao existe, rode supabase/sql/2026-02-11_create_pdi_items.sql.`
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const andamento = items.filter((x) => x.status === "em_andamento").length;
    const concluidos = items.filter((x) => x.status === "concluido").length;
    return { total, andamento, concluidos };
  }, [items]);

  async function addItem() {
    if (!userId) return;
    if (!title.trim()) {
      setMsg("Informe o objetivo do PDI.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        user_id: userId,
        title: title.trim(),
        action: action.trim() || null,
        target_date: targetDate || null,
        status: "planejado" as PdiStatus,
      };

      const { error } = await supabase.from("pdi_items").insert(payload);
      if (error) throw error;

      setTitle("");
      setAction("");
      setTargetDate("");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar item do PDI.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: PdiStatus) {
    setMsg("");
    try {
      const { error } = await supabase.from("pdi_items").update({ status }).eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar status.");
    }
  }

  async function removeItem(id: string) {
    const ok = window.confirm("Excluir este item do PDI?");
    if (!ok) return;
    setMsg("");
    try {
      const { error } = await supabase.from("pdi_items").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir item.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">PDI</h1>
            <p className="mt-1 text-sm text-slate-600">
              Gerencie seu Plano de Desenvolvimento Individual por objetivos e status.
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Em andamento</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.andamento}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Concluidos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.concluidos}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Novo item do PDI</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Objetivo"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
          />
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Acao (opcional)"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
          />
        </div>
        <div className="mt-3">
          <button
            onClick={() => void addItem()}
            disabled={saving || loading || !userId}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <Plus size={16} />
            {saving ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </div>

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
        <p className="text-sm font-semibold text-slate-900">Itens do PDI</p>

        <div className="mt-4 space-y-3">
          {items.length ? (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-600">{item.action || "Sem acao detalhada"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Prazo: {item.target_date ? new Date(item.target_date).toLocaleDateString("pt-BR") : "-"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                        statusClass(item.status),
                      ].join(" ")}
                    >
                      {statusLabel(item.status)}
                    </span>

                    <button
                      onClick={() => void setStatus(item.id, "em_andamento")}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Clock3 size={14} />
                      Em andamento
                    </button>
                    <button
                      onClick={() => void setStatus(item.id, "concluido")}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <CheckCircle2 size={14} />
                      Concluir
                    </button>
                    <button
                      onClick={() => void removeItem(item.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhum item cadastrado no PDI.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
