"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type NotificationRuleRow = {
  event_key: string;
  enabled: boolean;
  notify_assigned_user: boolean;
  notify_project_owner: boolean;
  notify_project_managers: boolean;
  notify_project_coordinators: boolean;
  notify_actor: boolean;
  link_default: string | null;
};

type RuleDraft = NotificationRuleRow;

const RULES: Array<{ key: string; label: string; description: string }> = [
  {
    key: "project_updated",
    label: "Projeto: dados alterados",
    description: "Dispara quando dados principais do projeto sao alterados.",
  },
  {
    key: "deliverable_updated",
    label: "Projeto: entregavel alterado",
    description: "Dispara quando um entregavel tem status ou dados do documento alterados.",
  },
  {
    key: "deliverable_approved",
    label: "Projeto: documento aprovado",
    description: "Dispara quando status do entregavel muda para aprovado.",
  },
  {
    key: "deliverable_approved_with_comments",
    label: "Projeto: documento aprovado com comentarios",
    description: "Dispara quando status do entregavel muda para aprovado com comentarios.",
  },
  {
    key: "pd_deliverable_approved",
    label: "P&D: entregavel aprovado",
    description: "Dispara quando status do entregavel P&D muda para aprovado.",
  },
  {
    key: "pd_deliverable_updated",
    label: "P&D: entregavel alterado",
    description: "Dispara quando um entregavel P&D tem status ou dados alterados.",
  },
  {
    key: "pd_deliverable_approved_with_comments",
    label: "P&D: entregavel aprovado com comentarios",
    description: "Dispara quando status do entregavel P&D muda para aprovado com comentarios.",
  },
];

const NOTIFICATION_LINK_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Sem link" },
  { value: "/notificacoes", label: "Central - Notificacoes" },
  { value: "/meu-perfil/projetos", label: "Meu Perfil - Projetos" },
  { value: "/coordenador/projetos", label: "Coordenador - Projetos" },
  { value: "/gestor/projetos", label: "Gestor - Projetos" },
  { value: "/diretoria/projetos", label: "Diretoria - Acompanhamento" },
  { value: "/p-d/projetos", label: "P&D - Projetos" },
  { value: "/financeiro/notas-fiscais", label: "Financeiro - Notas fiscais" },
  { value: "/rh/solicitacoes", label: "RH - Solicitacoes" },
];

function emptyDraft(eventKey: string): RuleDraft {
  const notifyActorByDefault =
    eventKey === "project_updated" || eventKey === "deliverable_updated" || eventKey === "pd_deliverable_updated";
  return {
    event_key: eventKey,
    enabled: true,
    notify_assigned_user: true,
    notify_project_owner: true,
    notify_project_managers: true,
    notify_project_coordinators: true,
    notify_actor: notifyActorByDefault,
    link_default: null,
  };
}

export default function AdminNotificacoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [draftByKey, setDraftByKey] = useState<Record<string, RuleDraft>>({});

  const orderedDrafts = useMemo(
    () => RULES.map((r) => ({ meta: r, draft: draftByKey[r.key] ?? emptyDraft(r.key) })),
    [draftByKey]
  );

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setUserId(authData.user.id);

      const { data, error } = await supabase
        .from("notification_automation_rules")
        .select("event_key,enabled,notify_assigned_user,notify_project_owner,notify_project_managers,notify_project_coordinators,notify_actor,link_default")
        .in("event_key", RULES.map((r) => r.key));
      if (error) throw error;

      const map: Record<string, RuleDraft> = {};
      for (const meta of RULES) map[meta.key] = emptyDraft(meta.key);
      for (const row of (data ?? []) as NotificationRuleRow[]) map[row.event_key] = row;
      setDraftByKey(map);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar configuracoes de notificacoes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      if (!userId) throw new Error("Sessao invalida.");
      const payload = RULES.map((meta) => {
        const d = draftByKey[meta.key] ?? emptyDraft(meta.key);
        return {
          ...d,
          link_default: (d.link_default ?? "").trim() || null,
          updated_by: userId,
        };
      });

      const { error } = await supabase
        .from("notification_automation_rules")
        .upsert(payload, { onConflict: "event_key" });
      if (error) throw error;

      setMsg("Configuracoes de notificacao salvas com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar configuracoes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Automacao de notificacoes</h1>
            <p className="mt-1 text-sm text-slate-600">
              Configure disparo automatico de notificacoes para aprovacoes de documentos.
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="space-y-4">
          {orderedDrafts.map(({ meta, draft }) => (
            <div key={meta.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                  <p className="text-xs text-slate-600">{meta.description}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) =>
                      setDraftByKey((prev) => ({ ...prev, [meta.key]: { ...draft, enabled: e.target.checked } }))
                    }
                  />
                  Ativar evento
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.notify_assigned_user}
                    onChange={(e) =>
                      setDraftByKey((prev) => ({ ...prev, [meta.key]: { ...draft, notify_assigned_user: e.target.checked } }))
                    }
                  />
                  Notificar colaborador responsavel
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.notify_project_owner}
                    onChange={(e) =>
                      setDraftByKey((prev) => ({ ...prev, [meta.key]: { ...draft, notify_project_owner: e.target.checked } }))
                    }
                  />
                  Notificar dono do projeto
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.notify_project_managers}
                    onChange={(e) =>
                      setDraftByKey((prev) => ({ ...prev, [meta.key]: { ...draft, notify_project_managers: e.target.checked } }))
                    }
                  />
                  Notificar gestores
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.notify_project_coordinators}
                    onChange={(e) =>
                      setDraftByKey((prev) => ({ ...prev, [meta.key]: { ...draft, notify_project_coordinators: e.target.checked } }))
                    }
                  />
                  Notificar coordenadores
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.notify_actor}
                    onChange={(e) =>
                      setDraftByKey((prev) => ({ ...prev, [meta.key]: { ...draft, notify_actor: e.target.checked } }))
                    }
                  />
                  Notificar tambem quem executou a acao
                </label>
              </div>

              <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-700">
                Destino da notificacao (setor/tela)
                <select
                  value={draft.link_default ?? ""}
                  onChange={(e) =>
                    setDraftByKey((prev) => ({ ...prev, [meta.key]: { ...draft, link_default: e.target.value } }))
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {NOTIFICATION_LINK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar configuracoes"}
          </button>
        </div>
      </div>
    </div>
  );
}
