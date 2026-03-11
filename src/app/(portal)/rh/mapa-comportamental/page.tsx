"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, Plus, RefreshCcw, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type InviteRow = {
  id: string;
  email: string;
  token: string;
  status: "pending" | "completed" | "expired" | "cancelled";
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type ReleaseRow = {
  id: string;
  user_id: string;
  collaborator_id: string | null;
  window_start: string;
  window_end: string;
  is_active: boolean;
  created_at: string;
};

type Collaborator = {
  id: string;
  nome: string | null;
  email: string | null;
  user_id: string | null;
  is_active: boolean;
};

function randomToken() {
  const base = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return base.replaceAll("-", "") + Date.now().toString(36);
}

function fmtDate(dateIso: string | null) {
  if (!dateIso) return "-";
  const d = new Date(dateIso);
  return Number.isNaN(d.getTime()) ? dateIso : d.toLocaleString("pt-BR");
}

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function endOfDayIso(dateInput: string) {
  return `${dateInput}T23:59:59.999Z`;
}

export default function RhMapaComportamentalPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedMany, setSelectedMany] = useState<Record<string, boolean>>({});
  const [windowStart, setWindowStart] = useState(toDateInput(new Date()));
  const [windowEnd, setWindowEnd] = useState(toDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [editWindowStart, setEditWindowStart] = useState("");
  const [editWindowEnd, setEditWindowEnd] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedReleases, setSelectedReleases] = useState<Record<string, boolean>>({});
  const [bulkWindowStart, setBulkWindowStart] = useState(toDateInput(new Date()));
  const [bulkWindowEnd, setBulkWindowEnd] = useState(toDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  const [savingBulkEdit, setSavingBulkEdit] = useState(false);
  const [deletingReleaseId, setDeletingReleaseId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [invRes, relRes, colRes] = await Promise.all([
        supabase
          .from("behavior_assessment_invites")
          .select("id,email,token,status,expires_at,completed_at,created_at")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("behavior_assessment_releases")
          .select("id,user_id,collaborator_id,window_start,window_end,is_active,created_at")
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("colaboradores")
          .select("id,nome,email,user_id,is_active")
          .eq("is_active", true)
          .order("nome", { ascending: true }),
      ]);

      if (invRes.error) throw invRes.error;
      if (relRes.error) throw relRes.error;
      if (colRes.error) throw colRes.error;

      setInvites((invRes.data ?? []) as InviteRow[]);
      setReleases((relRes.data ?? []) as ReleaseRow[]);
      setCollaborators((colRes.data ?? []) as Collaborator[]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar dados.");
      setInvites([]);
      setReleases([]);
      setCollaborators([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const pendingInvites = useMemo(
    () => invites.filter((item) => item.status === "pending").length,
    [invites]
  );
  const activeReleases = useMemo(
    () => releases.filter((item) => item.is_active).length,
    [releases]
  );

  const filteredCollaborators = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return collaborators;
    return collaborators.filter((c) => (c.nome ?? "").toLowerCase().includes(term));
  }, [collaborators, query]);

  const selectedManyIds = useMemo(
    () => Object.entries(selectedMany).filter(([, v]) => v).map(([id]) => id),
    [selectedMany]
  );

  const allFilteredSelected = useMemo(() => {
    if (!filteredCollaborators.length) return false;
    return filteredCollaborators.every((c) => selectedMany[c.id]);
  }, [filteredCollaborators, selectedMany]);

  const collaboratorNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of collaborators) {
      map[c.id] = c.nome?.trim() || "Colaborador sem nome";
    }
    return map;
  }, [collaborators]);

  const selectedReleaseIds = useMemo(
    () => Object.entries(selectedReleases).filter(([, checked]) => checked).map(([id]) => id),
    [selectedReleases]
  );

  const allReleasesSelected = useMemo(() => {
    if (!releases.length) return false;
    return releases.every((row) => !!selectedReleases[row.id]);
  }, [releases, selectedReleases]);

  function validateWindow() {
    if (!windowStart || !windowEnd) return "Informe inicio e fim da janela.";
    if (windowEnd < windowStart) return "A data final n?o pode ser menor que a inicial.";
    return null;
  }

  function toggleAllFiltered() {
    setSelectedMany((prev) => {
      const target = !allFilteredSelected;
      const next = { ...prev };
      for (const c of filteredCollaborators) next[c.id] = target;
      return next;
    });
  }

  async function createManualInvite() {
    if (!email.trim()) {
      setMsg("Informe o e-mail do colaborador.");
      return;
    }
    const err = validateWindow();
    if (err) {
      setMsg(err);
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) throw new Error("Sessao invalida.");

      const token = randomToken();
      const { error } = await supabase.from("behavior_assessment_invites").insert({
        invited_by: user.id,
        email: email.trim().toLowerCase(),
        token,
        expires_at: endOfDayIso(windowEnd),
      });
      if (error) throw error;

      const link = `${window.location.origin}/mapa-comportamental/${token}`;
      await navigator.clipboard.writeText(link);
      setMsg(`Convite criado e link copiado: ${link}`);
      setEmail("");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar convite.");
    } finally {
      setSaving(false);
    }
  }

  async function createReleasesForCollaborators(targetIds: string[]) {
    const err = validateWindow();
    if (err) {
      setMsg(err);
      return;
    }
    if (!targetIds.length) {
      setMsg("Selecione pelo menos um colaborador.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) throw new Error("Sessao invalida.");

      const selectedRows = targetIds
        .map((id) => collaborators.find((c) => c.id === id))
        .filter(Boolean) as Collaborator[];

      const releaseRows = selectedRows
        .filter((c) => !!c.user_id)
        .map((c) => ({
          user_id: c.user_id as string,
          collaborator_id: c.id,
          window_start: windowStart,
          window_end: windowEnd,
          is_active: true,
          created_by: user.id,
        }));

      const inviteRows = selectedRows
        .filter((c) => !c.user_id && !!c.email)
        .map((c) => ({
          invited_by: user.id,
          collaborator_id: c.id,
          email: (c.email as string).toLowerCase(),
          token: randomToken(),
          expires_at: endOfDayIso(windowEnd),
          status: "pending" as const,
        }));

      if (releaseRows.length) {
        const { error } = await supabase.from("behavior_assessment_releases").insert(releaseRows);
        if (error) throw error;
      }

      if (inviteRows.length) {
        const { error } = await supabase.from("behavior_assessment_invites").insert(inviteRows);
        if (error) throw error;
      }

      const semVinculoSemEmail = selectedRows.filter((c) => !c.user_id && !c.email).length;
      setMsg(
        [
          `Libera??es criadas: ${releaseRows.length}.`,
          inviteRows.length ? `Convites externos gerados: ${inviteRows.length}.` : "",
          semVinculoSemEmail ? `Sem user_id/e-mail: ${semVinculoSemEmail}.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );

      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao liberar avalia??o.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(token: string) {
    const link = `${window.location.origin}/mapa-comportamental/${token}`;
    await navigator.clipboard.writeText(link);
    setMsg(`Link copiado: ${link}`);
  }

  function validateRange(start: string, end: string) {
    if (!start || !end) return "Informe inicio e fim da janela.";
    if (end < start) return "A data final n?o pode ser menor que a inicial.";
    return null;
  }

  function toggleAllReleases() {
    setSelectedReleases((prev) => {
      const target = !allReleasesSelected;
      const next = { ...prev };
      for (const row of releases) next[row.id] = target;
      return next;
    });
  }

  async function saveBulkReleaseWindow() {
    if (!selectedReleaseIds.length) {
      setMsg("Selecione pelo menos uma libera??o.");
      return;
    }
    const err = validateRange(bulkWindowStart, bulkWindowEnd);
    if (err) {
      setMsg(err);
      return;
    }

    setSavingBulkEdit(true);
    setMsg("");
    try {
      const { error } = await supabase
        .from("behavior_assessment_releases")
        .update({
          window_start: bulkWindowStart,
          window_end: bulkWindowEnd,
        })
        .in("id", selectedReleaseIds);

      if (error) throw error;

      setReleases((prev) =>
        prev.map((row) =>
          selectedReleaseIds.includes(row.id)
            ? {
                ...row,
                window_start: bulkWindowStart,
                window_end: bulkWindowEnd,
              }
            : row
        )
      );
      setMsg(`Janela atualizada para ${selectedReleaseIds.length} libera??o(?es).`);
      setSelectedReleases({});
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar janela em lote.");
    } finally {
      setSavingBulkEdit(false);
    }
  }

  async function deleteRelease(releaseId: string) {
    const confirmed = window.confirm("Excluir esta libera??o? Essa a??o n?o pode ser desfeita.");
    if (!confirmed) return;

    setDeletingReleaseId(releaseId);
    setMsg("");
    try {
      const { error } = await supabase.from("behavior_assessment_releases").delete().eq("id", releaseId);
      if (error) throw error;

      setReleases((prev) => prev.filter((row) => row.id !== releaseId));
      setSelectedReleases((prev) => {
        const next = { ...prev };
        delete next[releaseId];
        return next;
      });
      if (editingReleaseId === releaseId) cancelEditRelease();
      setMsg("Libera??o exclu?da com sucesso.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir libera??o.");
    } finally {
      setDeletingReleaseId(null);
    }
  }

  function startEditRelease(row: ReleaseRow) {
    setEditingReleaseId(row.id);
    setEditWindowStart(row.window_start);
    setEditWindowEnd(row.window_end);
    setMsg("");
  }

  function cancelEditRelease() {
    setEditingReleaseId(null);
    setEditWindowStart("");
    setEditWindowEnd("");
  }

  async function saveReleaseWindow(releaseId: string) {
    if (!editWindowStart || !editWindowEnd) {
      setMsg("Informe inicio e fim da janela.");
      return;
    }
    if (editWindowEnd < editWindowStart) {
      setMsg("A data final n?o pode ser menor que a inicial.");
      return;
    }

    setSavingEdit(true);
    setMsg("");
    try {
      const { error } = await supabase
        .from("behavior_assessment_releases")
        .update({
          window_start: editWindowStart,
          window_end: editWindowEnd,
        })
        .eq("id", releaseId);

      if (error) throw error;

      setReleases((prev) =>
        prev.map((row) =>
          row.id === releaseId
            ? {
                ...row,
                window_start: editWindowStart,
                window_end: editWindowEnd,
              }
            : row
        )
      );
      setMsg("Janela da libera??o atualizada com sucesso.");
      cancelEditRelease();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar janela da libera??o.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Mapa comportamental</h1>
            <p className="mt-1 text-sm text-slate-600">
              O colaborador s? pode responder ap?s libera??o do RH, com janela de inicio/fim.
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Libera??es ativas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{activeReleases}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Convites pendentes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingInvites}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Colaboradores ativos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{collaborators.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Janela de libera??o</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Inicio
            <input
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              type="date"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-300"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Fim
            <input
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              type="date"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-300"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Liberar individual</p>
            <select
              value={selectedCollaboratorId}
              onChange={(e) => setSelectedCollaboratorId(e.target.value)}
              className="mt-3 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
            >
              <option value="">Selecione um colaborador</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome ?? "Sem nome"}
                </option>
              ))}
            </select>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void createReleasesForCollaborators(selectedCollaboratorId ? [selectedCollaboratorId] : [])}
                disabled={saving || !selectedCollaboratorId}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                <Users size={15} />
                Liberar individual
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Liberar em massa</p>
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
              placeholder="Buscar colaborador..."
              className="mt-3 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-300"
            />
            <div className="mt-3 max-h-[220px] overflow-auto rounded-xl border border-slate-200">
              {filteredCollaborators.length ? (
                <ul className="divide-y divide-slate-200">
                  {filteredCollaborators.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={!!selectedMany[c.id]}
                        onChange={(e) => setSelectedMany((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <span className="truncate text-sm text-slate-800">{c.nome ?? "Sem nome"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-3 text-sm text-slate-500">Nenhum colaborador encontrado.</div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void createReleasesForCollaborators(selectedManyIds)}
                disabled={saving || !selectedManyIds.length}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Liberar selecionados ({selectedManyIds.length})
              </button>
              <button
                type="button"
                onClick={() => void createReleasesForCollaborators(collaborators.map((c) => c.id))}
                disabled={saving || !collaborators.length}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                Liberar todos ativos
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Convite avulso por e-mail</p>
        <p className="mt-1 text-xs text-slate-500">
          Use para membros sem acesso ao portal (gera link externo com validade ate o fim da janela).
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            E-mail do membro
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-300"
              placeholder="membro@empresa.com"
              type="email"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void createManualInvite()}
              disabled={saving}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              <Plus size={16} />
              Criar convite
            </button>
          </div>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-900">Hist?rico de libera??es</p>
        <div className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Inicio (lote)
              <input
                type="date"
                value={bulkWindowStart}
                onChange={(e) => setBulkWindowStart(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-2 text-sm text-slate-900 outline-none focus:border-slate-300"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Fim (lote)
              <input
                type="date"
                value={bulkWindowEnd}
                onChange={(e) => setBulkWindowEnd(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-2 text-sm text-slate-900 outline-none focus:border-slate-300"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={toggleAllReleases}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                {allReleasesSelected ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void saveBulkReleaseWindow()}
                disabled={savingBulkEdit || !selectedReleaseIds.length}
                className="h-10 w-full rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                Salvar lote ({selectedReleaseIds.length})
              </button>
            </div>
            <div className="flex items-end">
              <div className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-600 flex items-center">
                Selecionadas: <b className="ml-1 text-slate-900">{selectedReleaseIds.length}</b>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3 w-[44px]">Sel.</th>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Janela</th>
                <th className="p-3">Status</th>
                <th className="p-3">Criado em</th>
                <th className="p-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : releases.length ? (
                releases.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={!!selectedReleases[item.id]}
                        onChange={(e) => setSelectedReleases((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="p-3">{item.collaborator_id ? collaboratorNameById[item.collaborator_id] ?? "-" : "-"}</td>
                    <td className="p-3">
                      {editingReleaseId === item.id ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            type="date"
                            value={editWindowStart}
                            onChange={(e) => setEditWindowStart(e.target.value)}
                            className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-900 outline-none focus:border-slate-300"
                          />
                          <input
                            type="date"
                            value={editWindowEnd}
                            onChange={(e) => setEditWindowEnd(e.target.value)}
                            className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-900 outline-none focus:border-slate-300"
                          />
                        </div>
                      ) : (
                        <>
                          {new Date(`${item.window_start}T00:00:00`).toLocaleDateString("pt-BR")} ate{" "}
                          {new Date(`${item.window_end}T00:00:00`).toLocaleDateString("pt-BR")}
                        </>
                      )}
                    </td>
                    <td className="p-3">{item.is_active ? "Ativa" : "Inativa"}</td>
                    <td className="p-3">{fmtDate(item.created_at)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        {editingReleaseId === item.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void saveReleaseWindow(item.id)}
                              disabled={savingEdit || deletingReleaseId === item.id}
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-60"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditRelease}
                              disabled={savingEdit || deletingReleaseId === item.id}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditRelease(item)}
                              disabled={deletingReleaseId === item.id}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Editar janela
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteRelease(item.id)}
                              disabled={deletingReleaseId === item.id}
                              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              {deletingReleaseId === item.id ? "Excluindo..." : "Excluir"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Nenhuma libera??o registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-900">Convites externos</p>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">E-mail</th>
                <th className="p-3">Status</th>
                <th className="p-3">Criado em</th>
                <th className="p-3">Expira em</th>
                <th className="p-3">Concluido em</th>
                <th className="p-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : invites.length ? (
                invites.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="p-3">{item.email}</td>
                    <td className="p-3">{item.status}</td>
                    <td className="p-3">{fmtDate(item.created_at)}</td>
                    <td className="p-3">{fmtDate(item.expires_at)}</td>
                    <td className="p-3">{fmtDate(item.completed_at)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void copyLink(item.token)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Copy size={14} />
                          Copiar link
                        </button>
                        <a
                          href={`/mapa-comportamental/${item.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Link2 size={14} />
                          Abrir
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Nenhum convite registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
