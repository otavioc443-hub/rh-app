"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Plus, Pencil, Trash2, Save, X, Search, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader, Card, CardBody } from "@/components/ui/PageShell";

type CargoRow = {
  id: string;
  name: string;
  cbo: string | null;
  created_at: string | null;
};

type CargoPayload = {
  name: string;
  cbo: string | null;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function CargosPage() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<CargoRow[]>([]);
  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [cbo, setCbo] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCbo, setEditCbo] = useState("");

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const { data, error } = await supabase.from("cargos").select("id,name,cbo,created_at").order("name", { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as CargoRow[]);
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Erro ao carregar cargos."}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => (r.name ?? "").toLowerCase().includes(term) || (r.cbo ?? "").toLowerCase().includes(term));
  }, [rows, q]);

  async function addCargo() {
    setMsg("");
    const n = name.trim();
    if (!n) return setMsg("Informe o nome do cargo.");

    setLoading(true);
    try {
      // upsert por name (precisa de unique no banco — deixei o SQL no final)
      const payload: CargoPayload = { name: n, cbo: cbo.trim() || null };
      const { error } = await supabase.from("cargos").upsert(payload, { onConflict: "name" });
      if (error) throw error;

      setName("");
      setCbo("");
      setMsg("✅ Cargo salvo.");
      await load();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Erro ao salvar cargo."}`);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(r: CargoRow) {
    setEditingId(r.id);
    setEditName(r.name ?? "");
    setEditCbo(r.cbo ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditCbo("");
  }

  async function saveEdit(id: string) {
    setMsg("");
    const n = editName.trim();
    if (!n) return setMsg("Informe um nome válido.");

    setLoading(true);
    try {
      const payload: CargoPayload = { name: n, cbo: editCbo.trim() || null };
      const { error } = await supabase.from("cargos").update(payload).eq("id", id);
      if (error) throw error;

      setMsg("✅ Atualizado.");
      cancelEdit();
      await load();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Erro ao atualizar."}`);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    const ok = window.confirm("Excluir este cargo?");
    if (!ok) return;

    setMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.from("cargos").delete().eq("id", id);
      if (error) throw error;

      setMsg("✅ Removido.");
      await load();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Erro ao excluir."}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <PageHeader
        icon={<Briefcase size={22} />}
        title="Inclusão Cargos"
        subtitle="Cadastre e gerencie cargos para usar no cadastro de colaboradores."
      />

      {msg ? (
        <Card>
          <CardBody>
            <div className="text-sm text-slate-800">{msg}</div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="grid w-full gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Nome do cargo</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Analista de RH"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600">CBO (opcional)</label>
                <input
                  value={cbo}
                  onChange={(e) => setCbo(e.target.value)}
                  placeholder="Ex: 2524-05"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addCargo}
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  <Plus size={16} />
                  {loading ? "Salvando..." : "Adicionar cargo"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-[420px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou CBO..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-300"
              />
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={cx(loading && "animate-spin")} />
              Atualizar
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">Cargos ({filtered.length})</div>

            <div className="divide-y divide-slate-200">
              {filtered.map((r) => {
                const editing = editingId === r.id;

                return (
                  <div key={r.id} className="px-4 py-3">
                    {!editing ? (
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{r.name}</div>
                          <div className="text-xs text-slate-500">{r.cbo ? `CBO: ${r.cbo}` : "CBO: —"}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(r)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            <Pencil size={14} />
                            Editar
                          </button>

                          <button
                            onClick={() => remove(r.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600">Nome</label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600">CBO</label>
                          <input
                            value={editCbo}
                            onChange={(e) => setEditCbo(e.target.value)}
                            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            onClick={() => saveEdit(r.id)}
                            disabled={loading}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                          >
                            <Save size={16} />
                            Salvar
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            <X size={16} />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500">Nenhum cargo encontrado.</div>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
