"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CalendarClock, Users, Wand2 } from "lucide-react";

type Colaborador = {
  id: string;
  user_id: string | null;
  nome: string | null;
  is_active: boolean;
};

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
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

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome, user_id, is_active")
        .eq("is_active", true)
        .order("nome", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("Erro ao carregar colaboradores:", error.message);
        setColaboradores([]);
      } else {
        setColaboradores((data ?? []) as Colaborador[]);
      }

      setLoading(false);
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
      setMessage(`Liberação em massa criada para ${rows.length} colaborador(es) ✅`);
    } finally {
      setSaving(false);
    }
  }

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
    </div>
  );
}
