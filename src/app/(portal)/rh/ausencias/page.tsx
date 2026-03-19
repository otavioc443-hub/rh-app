"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CalendarClock, Users, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Colaborador = {
  id: string;
  user_id: string | null;
  nome: string | null;
  is_active: boolean;
};

type AllowanceHistoryRow = {
  id: string;
  user_id: string;
  collaborator_id: string | null;
  valid_from: string;
  valid_to: string;
  max_days: number | null;
  window_start: string | null;
  window_end: string | null;
  days_allowed: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function plusDaysISO(base: string, days: number) {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function RHAusenciasPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCollabId, setSelectedCollabId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [selectedMany, setSelectedMany] = useState<Record<string, boolean>>({});

  const [windowStart, setWindowStart] = useState(todayISO());
  const [windowEnd, setWindowEnd] = useState(plusDaysISO(todayISO(), 30));
  const [daysAllowed, setDaysAllowed] = useState<number>(1);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<AllowanceHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySaving, setHistorySaving] = useState(false);
  const [historyMsg, setHistoryMsg] = useState<string | null>(null);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editDays, setEditDays] = useState<number>(1);
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setHistoryLoading(true);
      const [collabRes, histRes] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("id, nome, user_id, is_active")
          .eq("is_active", true)
          .order("nome", { ascending: true }),
        supabase
          .from("absence_allowances")
          .select("id,user_id,collaborator_id,valid_from,valid_to,max_days,window_start,window_end,days_allowed,is_active,created_by,created_at,updated_at")
          .order("created_at", { ascending: false }),
      ]);

      if (!alive) return;

      if (collabRes.error) {
        console.error("Erro ao carregar colaboradores:", collabRes.error.message);
        setColaboradores([]);
      } else {
        setColaboradores((collabRes.data ?? []) as Colaborador[]);
      }

      if (histRes.error) {
        console.error("Erro ao carregar historico de liberacoes:", histRes.error.message);
        setHistory([]);
      } else {
        const rows = (histRes.data ?? []) as AllowanceHistoryRow[];
        setHistory(rows);
        const creatorIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean))) as string[];
        if (creatorIds.length) {
          const profRes = await supabase.from("profiles").select("id,full_name").in("id", creatorIds);
          if (!profRes.error) {
            const map: Record<string, string> = {};
            for (const p of (profRes.data ?? []) as Array<{ id: string; full_name: string | null }>) {
              const n = (p.full_name ?? "").trim();
              map[p.id] = n && !n.includes("@") ? n : "Usuario sem nome";
            }
            setCreatorNames(map);
          }
        }
      }

      setLoading(false);
      setHistoryLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const selected = useMemo(
    () => colaboradores.find((c) => c.id === selectedCollabId) ?? null,
    [colaboradores, selectedCollabId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colaboradores;
    return colaboradores.filter((c) => (c.nome ?? "").toLowerCase().includes(q));
  }, [colaboradores, query]);

  const selectedManyIds = useMemo(
    () => Object.entries(selectedMany).filter(([, v]) => v).map(([k]) => k),
    [selectedMany]
  );

  const allFilteredSelected = useMemo(() => {
    if (filtered.length === 0) return false;
    return filtered.every((c) => selectedMany[c.id]);
  }, [filtered, selectedMany]);

  function toggleAllFiltered() {
    setSelectedMany((prev) => {
      const next = { ...prev };
      const target = !allFilteredSelected;
      for (const c of filtered) next[c.id] = target;
      return next;
    });
  }

  function validateForm() {
    if (!windowStart || !windowEnd) return "Informe início e fim.";
    if (windowEnd < windowStart) return "A data final não pode ser menor que a inicial.";
    if (!daysAllowed || daysAllowed < 1) return "Dias liberados deve ser pelo menos 1.";
    return null;
  }

  async function getCreatorId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  }

  // ✅ Payload compatível com seu schema (valid_from/valid_to NOT NULL)
  function buildAllowanceRow(params: {
    user_id: string;
    collaborator_id: string;
    created_by: string;
  }) {
    return {
      user_id: params.user_id,                // NOT NULL
      collaborator_id: params.collaborator_id,

      // colunas "novas"
      days_allowed: daysAllowed,
      window_start: windowStart,
      window_end: windowEnd,

      // colunas "legadas" NOT NULL
      valid_from: windowStart,
      valid_to: windowEnd,
      max_days: daysAllowed,

      created_by: params.created_by,
      is_active: true,
    };
  }

  async function handleLiberarIndividual() {
    setMessage(null);

    const err = validateForm();
    if (err) return setMessage(err);
    if (!selected) return setMessage("Selecione um colaborador.");
    if (!selected.user_id) return setMessage("Este colaborador não tem user_id vinculado.");

    setSaving(true);
    try {
      const creatorId = await getCreatorId();
      if (!creatorId) return setMessage("Sessão inválida. Faça login novamente.");

      const payload = buildAllowanceRow({
        user_id: selected.user_id,
        collaborator_id: selected.id,
        created_by: creatorId,
      });

      const { error } = await supabase.from("absence_allowances").insert(payload);

      if (error) return setMessage("Erro ao salvar: " + error.message);
      await fetch("/api/rh/ausencias/allowances/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowances: [payload] }),
      }).catch(() => null);
      await refreshHistory();
      setMessage("Liberação individual criada com sucesso ✅");
    } finally {
      setSaving(false);
    }
  }

  async function handleLiberarMassa() {
    setMessage(null);

    const err = validateForm();
    if (err) return setMessage(err);
    if (selectedManyIds.length === 0) return setMessage("Selecione pelo menos 1 colaborador.");

    const selectedRows = selectedManyIds
      .map((id) => colaboradores.find((c) => c.id === id))
      .filter(Boolean) as Colaborador[];

    const semUser = selectedRows.filter((c) => !c.user_id);
    if (semUser.length > 0) {
      return setMessage(`Alguns selecionados estão sem user_id (${semUser.length}).`);
    }

    setSaving(true);
    try {
      const creatorId = await getCreatorId();
      if (!creatorId) return setMessage("Sessão inválida. Faça login novamente.");

      const rows = selectedRows.map((c) =>
        buildAllowanceRow({
          user_id: c.user_id!,
          collaborator_id: c.id,
          created_by: creatorId,
        })
      );

      const { error } = await supabase.from("absence_allowances").insert(rows);

      if (error) return setMessage("Erro ao liberar em massa: " + error.message);
      await fetch("/api/rh/ausencias/allowances/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowances: rows }),
      }).catch(() => null);
      await refreshHistory();
      setMessage(`Liberação em massa criada para ${rows.length} colaborador(es) ✅`);
    } finally {
      setSaving(false);
    }
  }

  async function refreshHistory() {
    setHistoryLoading(true);
    setHistoryMsg(null);
    try {
      const { data, error } = await supabase
        .from("absence_allowances")
        .select("id,user_id,collaborator_id,valid_from,valid_to,max_days,window_start,window_end,days_allowed,is_active,created_by,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setHistory((data ?? []) as AllowanceHistoryRow[]);
    } catch (e: unknown) {
      setHistoryMsg(e instanceof Error ? e.message : "Erro ao carregar historico.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function startEdit(row: AllowanceHistoryRow) {
    setEditingId(row.id);
    setEditStart((row.window_start ?? row.valid_from ?? "").slice(0, 10));
    setEditEnd((row.window_end ?? row.valid_to ?? "").slice(0, 10));
    setEditDays(Number(row.days_allowed ?? row.max_days ?? 1) || 1);
    setEditActive(!!row.is_active);
    setHistoryMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setHistoryMsg(null);
  }

  async function saveHistoryEdit(id: string) {
    if (!editStart || !editEnd) return setHistoryMsg("Informe inicio e fim.");
    if (editEnd < editStart) return setHistoryMsg("Data final menor que a inicial.");
    if (!editDays || editDays < 1) return setHistoryMsg("Dias liberados deve ser >= 1.");

    setHistorySaving(true);
    setHistoryMsg(null);
    try {
      const { error } = await supabase
        .from("absence_allowances")
        .update({
          window_start: editStart,
          window_end: editEnd,
          days_allowed: editDays,
          valid_from: editStart,
          valid_to: editEnd,
          max_days: editDays,
          is_active: editActive,
        })
        .eq("id", id);
      if (error) throw error;
      const target = history.find((h) => h.id === id);
      if (target) {
        await fetch("/api/rh/ausencias/allowances/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: editActive ? "updated" : "deactivated",
            allowances: [
              {
                user_id: target.user_id,
                collaborator_id: target.collaborator_id,
                valid_from: editStart,
                valid_to: editEnd,
                max_days: editDays,
                window_start: editStart,
                window_end: editEnd,
                days_allowed: editDays,
              },
            ],
          }),
        }).catch(() => null);
      }
      setEditingId(null);
      setHistoryMsg("Liberacao atualizada com sucesso.");
      await refreshHistory();
    } catch (e: unknown) {
      setHistoryMsg(e instanceof Error ? e.message : "Erro ao atualizar liberacao.");
    } finally {
      setHistorySaving(false);
    }
  }

  async function deleteHistory(id: string) {
    if (!window.confirm("Excluir esta liberacao?")) return;
    setHistorySaving(true);
    setHistoryMsg(null);
    try {
      const { error } = await supabase.from("absence_allowances").delete().eq("id", id);
      if (error) throw error;
      const target = history.find((h) => h.id === id);
      if (target) {
        await fetch("/api/rh/ausencias/allowances/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deleted",
            allowances: [
              {
                user_id: target.user_id,
                collaborator_id: target.collaborator_id,
                valid_from: target.window_start ?? target.valid_from,
                valid_to: target.window_end ?? target.valid_to,
                max_days: target.days_allowed ?? target.max_days ?? 0,
                window_start: target.window_start ?? target.valid_from,
                window_end: target.window_end ?? target.valid_to,
                days_allowed: target.days_allowed ?? target.max_days ?? 0,
              },
            ],
          }),
        }).catch(() => null);
      }
      if (editingId === id) setEditingId(null);
      setHistoryMsg("Liberacao excluida com sucesso.");
      await refreshHistory();
    } catch (e: unknown) {
      setHistoryMsg(e instanceof Error ? e.message : "Erro ao excluir liberacao.");
    } finally {
      setHistorySaving(false);
    }
  }

  function fmtDate(iso: string) {
    if (!iso) return "-";
    const [y, m, d] = iso.slice(0, 10).split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  function fmtDateTime(iso: string | null | undefined) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR");
  }

  const colaboradorNomeByRef = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of colaboradores) {
      const nome = (c.nome ?? "").trim() || "Colaborador sem nome";
      map[c.id] = nome;
      if (c.user_id) map[c.user_id] = nome;
    }
    return map;
  }, [colaboradores]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Gerenciador de ausências (RH)</h1>
        <p className="mt-1 text-sm text-slate-600">Defina limites de solicitação por colaborador.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Colaboradores" value={loading ? "…" : String(colaboradores.length)} icon={Users} />
        <KpiCard label="Liberações" value="—" icon={CalendarClock} />
        <KpiCard label="Solicitações" value="—" icon={Wand2} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Liberar dias para solicitação</p>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Individual: só nome */}
          <div>
            <label className="text-sm font-semibold text-slate-900">Colaborador (individual)</label>
            <select
              value={selectedCollabId}
              onChange={(e) => setSelectedCollabId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">{loading ? "Carregando..." : "Selecione um colaborador"}</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome ?? "Sem nome"}
                </option>
              ))}
            </select>
          </div>

          {/* Massa: só nome */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <label className="text-sm font-semibold text-slate-900">Colaboradores (em massa)</label>
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="text-xs font-semibold text-slate-700 hover:underline"
              >
                {allFilteredSelected ? "Desmarcar filtrados" : "Marcar filtrados"}
              </button>
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome…"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />

            <div className="mt-3 max-h-[220px] overflow-auto rounded-xl border border-slate-200">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Nenhum colaborador encontrado.</div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {filtered.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={!!selectedMany[c.id]}
                        onChange={(e) =>
                          setSelectedMany((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                        className="h-4 w-4"
                      />
                      <p className="truncate text-sm font-medium text-slate-900">{c.nome ?? "Sem nome"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Selecionados: <span className="font-semibold">{selectedManyIds.length}</span>
            </div>
          </div>
        </div>

        {/* Regras */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-semibold">Início</label>
            <input
              type="date"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Fim</label>
            <input
              type="date"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Dias liberados</label>
            <input
              type="number"
              min={1}
              value={daysAllowed}
              onChange={(e) => setDaysAllowed(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleLiberarIndividual}
            disabled={!selectedCollabId || saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Liberar individual"}
          </button>

          <button
            onClick={handleLiberarMassa}
            disabled={selectedManyIds.length === 0 || saving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Liberar em massa"}
          </button>

          {message && <span className="text-sm text-slate-700">{message}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Historico de liberacoes</p>
            <p className="mt-1 text-sm text-slate-600">
              Consulte, edite e exclua liberacoes realizadas pelo RH (com auditoria de quem e quando).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshHistory()}
            disabled={historyLoading || historySaving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            {historyLoading ? "Atualizando..." : "Atualizar historico"}
          </button>
        </div>

        {historyMsg ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {historyMsg}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Janela</th>
                <th className="p-3">Dias</th>
                <th className="p-3">Status</th>
                <th className="p-3">Criado por</th>
                <th className="p-3">Criado em</th>
                <th className="p-3">Atualizado em</th>
                <th className="p-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={8} className="p-3 text-slate-500">Carregando historico...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-3 text-slate-500">Nenhuma liberacao encontrada.</td>
                </tr>
              ) : (
                history.map((r) => {
                  const isEditing = editingId === r.id;
                  const start = (r.window_start ?? r.valid_from ?? "").slice(0, 10);
                  const end = (r.window_end ?? r.valid_to ?? "").slice(0, 10);
                  const days = Number(r.days_allowed ?? r.max_days ?? 0) || 0;
                  const collabName =
                    (r.collaborator_id && colaboradorNomeByRef[r.collaborator_id]) ||
                    colaboradorNomeByRef[r.user_id] ||
                    "Colaborador sem nome";
                  const creatorName =
                    (r.created_by && creatorNames[r.created_by]) ||
                    (r.created_by ? `Usuario ${r.created_by.slice(0, 8)}` : "-");

                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-3 font-medium text-slate-900">{collabName}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="date"
                              value={editStart}
                              onChange={(e) => setEditStart(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                            <input
                              type="date"
                              value={editEnd}
                              onChange={(e) => setEditEnd(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          </div>
                        ) : (
                          <span>{fmtDate(start)} ate {fmtDate(end)}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            value={editDays}
                            onChange={(e) => setEditDays(Number(e.target.value))}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                        ) : (
                          days
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={editActive}
                              onChange={(e) => setEditActive(e.target.checked)}
                            />
                            Ativa
                          </label>
                        ) : (
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {r.is_active ? "Ativa" : "Inativa"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-700">{creatorName}</td>
                      <td className="p-3 text-slate-700">{fmtDateTime(r.created_at)}</td>
                      <td className="p-3 text-slate-700">{fmtDateTime(r.updated_at)}</td>
                      <td className="p-3">
                        <div className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 p-2">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Acoes da liberacao
                          </div>
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void saveHistoryEdit(r.id)}
                              disabled={historySaving}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={historySaving}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteHistory(r.id)}
                              disabled={historySaving}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(r)}
                              disabled={historySaving}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteHistory(r.id)}
                              disabled={historySaving}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

