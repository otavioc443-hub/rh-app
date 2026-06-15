"use client";

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Pencil, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type Announcement = {
  id: string;
  company_id: string | null;
  label: string;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
  display_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type Draft = {
  label: string;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
  display_order: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
};

const EMPTY_DRAFT: Draft = {
  label: "Comunicado",
  title: "",
  body: "",
  cta_label: "Ver comunicados",
  cta_href: "/institucional/rede-social",
  display_order: "0",
  active: true,
  starts_at: "",
  ends_at: "",
};

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function draftFrom(row: Announcement): Draft {
  return {
    label: row.label || "Comunicado",
    title: row.title || "",
    body: row.body || "",
    cta_label: row.cta_label || "Ver comunicados",
    cta_href: row.cta_href || "/institucional/rede-social",
    display_order: String(row.display_order ?? 0),
    active: row.active,
    starts_at: toDateTimeLocal(row.starts_at),
    ends_at: toDateTimeLocal(row.ends_at),
  };
}

export default function AdminComunicadosPage() {
  const router = useRouter();
  const { loading: roleLoading, active, role } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [rows, setRows] = useState<Announcement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const canAccess = active && role === "admin";
  const editingRow = useMemo(() => rows.find((row) => row.id === editingId) ?? null, [editingId, rows]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setUserId(authData.user.id);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", authData.user.id)
        .maybeSingle<{ company_id: string | null }>();
      if (profileErr) throw profileErr;
      setCompanyId(profile?.company_id ?? null);

      const { data, error } = await supabase
        .from("pulsehub_home_announcements")
        .select("id,company_id,label,title,body,cta_label,cta_href,display_order,active,starts_at,ends_at,created_at")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as Announcement[]);
    } catch (e: unknown) {
      setRows([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar comunicados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (roleLoading) return;
    if (!canAccess) {
      router.replace("/unauthorized");
      return;
    }
    void load();
  }, [roleLoading, canAccess, router]);

  function startEdit(row: Announcement) {
    setEditingId(row.id);
    setDraft(draftFrom(row));
    setMsg("");
  }

  function resetForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setMsg("");
  }

  async function save() {
    if (!draft.title.trim() || !draft.body.trim()) {
      setMsg("Informe titulo e texto do comunicado.");
      return;
    }
    if (!userId) {
      setMsg("Sessao invalida.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        company_id: companyId,
        label: draft.label.trim() || "Comunicado",
        title: draft.title.trim(),
        body: draft.body.trim(),
        cta_label: draft.cta_label.trim() || "Ver comunicados",
        cta_href: draft.cta_href.trim() || "/institucional/rede-social",
        display_order: Number.isFinite(Number(draft.display_order)) ? Number(draft.display_order) : 0,
        active: draft.active,
        starts_at: fromDateTimeLocal(draft.starts_at),
        ends_at: fromDateTimeLocal(draft.ends_at),
        updated_by: userId,
      };

      const res = editingId
        ? await supabase.from("pulsehub_home_announcements").update(payload).eq("id", editingId).select("id").maybeSingle<{ id: string }>()
        : await supabase.from("pulsehub_home_announcements").insert({ ...payload, created_by: userId }).select("id").maybeSingle<{ id: string }>();

      if (res.error) throw res.error;
      const announcementId = res.data?.id ?? editingId;
      if (announcementId && payload.active) {
        await fetch("/api/admin/comunicados/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ announcement_id: announcementId, mode: editingId ? "updated" : "created" }),
        }).catch(() => null);
      }
      setMsg(editingId ? "Comunicado atualizado." : "Comunicado cadastrado.");
      resetForm();
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar comunicado.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Announcement) {
    const ok = window.confirm(`Excluir o comunicado "${row.title}"?`);
    if (!ok) return;
    setMsg("");
    try {
      const { error } = await supabase.from("pulsehub_home_announcements").delete().eq("id", row.id);
      if (error) throw error;
      if (editingId === row.id) resetForm();
      setRows((current) => current.filter((item) => item.id !== row.id));
      setMsg("Comunicado excluido.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir comunicado.");
    }
  }

  if (roleLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Validando acesso...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
              <Megaphone size={18} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Comunicados da home</h1>
              <p className="mt-1 text-sm text-slate-600">
                Cadastre os comunicados exibidos no carrossel principal da tela inicial.
              </p>
            </div>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,460px)_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{editingRow ? "Editar comunicado" : "Novo comunicado"}</p>
            {editingRow ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus size={14} />
                Novo
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Tag
              <input
                value={draft.label}
                onChange={(e) => setDraft((current) => ({ ...current, label: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Titulo
              <input
                value={draft.title}
                onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
                placeholder="Ex.: Pesquisa de clima 2026"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Texto
              <textarea
                value={draft.body}
                onChange={(e) => setDraft((current) => ({ ...current, body: e.target.value }))}
                placeholder="Resumo do comunicado exibido na home."
                className="min-h-[110px] rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Texto do botão
                <input
                  value={draft.cta_label}
                  onChange={(e) => setDraft((current) => ({ ...current, cta_label: e.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Ordem
                <input
                  type="number"
                  value={draft.display_order}
                  onChange={(e) => setDraft((current) => ({ ...current, display_order: e.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Link do botão
              <input
                value={draft.cta_href}
                onChange={(e) => setDraft((current) => ({ ...current, cta_href: e.target.value }))}
                placeholder="/institucional/rede-social"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Inicio da exibição
                <input
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => setDraft((current) => ({ ...current, starts_at: e.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Fim da exibição
                <input
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => setDraft((current) => ({ ...current, ends_at: e.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft((current) => ({ ...current, active: e.target.checked }))}
              />
              Comunicado ativo
            </label>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Salvando..." : editingRow ? "Salvar alterações" : "Cadastrar comunicado"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Comunicados cadastrados</p>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">Carregando...</div>
            ) : rows.length ? (
              rows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{row.label}</span>
                        <span className={row.active ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-rose-700"}>
                          {row.active ? "Ativo" : "Inativo"}
                        </span>
                        <span className="text-xs text-slate-500">Ordem {row.display_order}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{row.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{row.body}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Botão: {row.cta_label} | {row.cta_href}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(row)}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
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
                Nenhum comunicado cadastrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
