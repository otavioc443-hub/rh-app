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
    key: "home_announcement",
    label: "Comunicados: home",
    description: "Dispara comunicados publicados no carrossel da home para o megafone.",
  },
  {
    key: "pulsehub_announcement",
    label: "PulseHub: comunicado oficial",
    description: "Dispara comunicados oficiais do PulseHub na central única.",
  },
  {
    key: "pulsehub_campaign",
    label: "PulseHub: campanha interna",
    description: "Dispara campanhas internas do PulseHub na central única.",
  },
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
  {
    key: "absence_allowance_created",
    label: "RH: ausencia programada liberada",
    description: "Dispara quando RH/Admin cria liberacao de periodo de ausencia para colaborador.",
  },
  {
    key: "absence_allowance_updated",
    label: "RH: ausencia programada atualizada",
    description: "Dispara quando RH/Admin edita uma liberacao de periodo de ausencia.",
  },
  {
    key: "absence_allowance_deactivated",
    label: "RH: ausencia programada desativada",
    description: "Dispara quando RH/Admin desativa uma liberacao de periodo de ausencia.",
  },
  {
    key: "absence_allowance_deleted",
    label: "RH: ausencia programada excluida",
    description: "Dispara quando RH/Admin exclui uma liberacao de periodo de ausencia.",
  },
  {
    key: "absence_request_created",
    label: "Ausencias: solicitacao enviada",
    description: "Dispara quando colaborador envia solicitacao de ausencia para aprovacao do gestor.",
  },
  {
    key: "absence_request_updated",
    label: "Ausencias: solicitacao atualizada",
    description: "Dispara quando colaborador edita/reenvia uma solicitacao de ausencia.",
  },
  {
    key: "absence_request_cancelled",
    label: "Ausencias: solicitacao cancelada",
    description: "Dispara quando colaborador cancela uma solicitacao de ausencia.",
  },
  {
    key: "absence_request_approved",
    label: "Ausencias: solicitacao aprovada",
    description: "Dispara quando gestor aprova uma solicitacao de ausencia.",
  },
  {
    key: "absence_request_rejected",
    label: "Ausencias: solicitacao recusada",
    description: "Dispara quando gestor recusa uma solicitacao de ausencia.",
  },
  {
    key: "support_ticket_created",
    label: "Chamados: novo chamado",
    description: "Dispara quando colaborador abre chamado para RH, Financeiro ou P&D.",
  },
  {
    key: "invoice_submitted",
    label: "Financeiro: nota fiscal enviada",
    description: "Dispara quando colaborador envia nota fiscal para analise.",
  },
  {
    key: "invoice_approved",
    label: "Financeiro: nota fiscal aprovada",
    description: "Dispara quando Financeiro aprova uma nota fiscal.",
  },
  {
    key: "invoice_rejected",
    label: "Financeiro: nota fiscal recusada",
    description: "Dispara quando Financeiro recusa uma nota fiscal.",
  },
  {
    key: "invoice_cancelled",
    label: "Financeiro: nota fiscal cancelada",
    description: "Dispara quando uma nota fiscal e cancelada.",
  },
  {
    key: "extra_payment_created",
    label: "Financeiro: pagamento extra pendente",
    description: "Dispara quando gestor solicita pagamento extra.",
  },
  {
    key: "extra_payment_approved",
    label: "Financeiro: pagamento extra aprovado",
    description: "Dispara quando Financeiro aprova pagamento extra.",
  },
  {
    key: "extra_payment_rejected",
    label: "Financeiro: pagamento extra recusado",
    description: "Dispara quando Financeiro recusa pagamento extra.",
  },
  {
    key: "extra_payment_paid",
    label: "Financeiro: pagamento extra pago",
    description: "Dispara quando Financeiro marca pagamento extra como pago.",
  },
  {
    key: "feedback_submitted",
    label: "Desenvolvimento: feedback enviado",
    description: "Dispara quando feedback e registrado para colaborador.",
  },
  {
    key: "feedback_released",
    label: "Desenvolvimento: feedback liberado",
    description: "Dispara quando feedback fica disponivel para ciencia do colaborador.",
  },
  {
    key: "pdi_created",
    label: "Desenvolvimento: PDI criado",
    description: "Dispara quando um PDI e criado para o colaborador.",
  },
  {
    key: "pdi_updated",
    label: "Desenvolvimento: PDI atualizado",
    description: "Dispara quando um PDI e atualizado.",
  },
  {
    key: "behavior_invite",
    label: "Mapa comportamental: convite",
    description: "Dispara quando colaborador recebe convite de mapa comportamental.",
  },
  {
    key: "behavior_completed",
    label: "Mapa comportamental: concluido",
    description: "Dispara quando um mapa comportamental e concluido para analise.",
  },
  {
    key: "lgpd_request_created",
    label: "Privacidade: solicitacao LGPD criada",
    description: "Dispara para responsaveis quando uma solicitacao LGPD e aberta.",
  },
  {
    key: "lgpd_request_updated",
    label: "Privacidade: solicitacao LGPD atualizada",
    description: "Dispara para solicitante quando uma solicitacao LGPD muda de status.",
  },
  {
    key: "ethics_case_created",
    label: "Etica: novo relato",
    description: "Dispara para Compliance/RH/Admin quando um relato e registrado.",
  },
  {
    key: "ethics_case_updated",
    label: "Etica: caso atualizado",
    description: "Dispara para responsaveis quando um caso de etica muda.",
  },
  {
    key: "pd_ticket_created",
    label: "P&D: chamado criado",
    description: "Dispara para suporte P&D quando um chamado tecnico e aberto.",
  },
  {
    key: "pd_ticket_updated",
    label: "P&D: chamado atualizado",
    description: "Dispara para solicitante quando chamado P&D muda de status.",
  },
  {
    key: "institutional_event_created",
    label: "Agenda: evento institucional",
    description: "Dispara quando RH/Admin cria evento institucional relevante.",
  },
  {
    key: "lms_assignment",
    label: "LMS: treinamento atribuido",
    description: "Dispara quando treinamento ou trilha e atribuido.",
  },
  {
    key: "lms_due_soon",
    label: "LMS: prazo proximo",
    description: "Dispara lembrete de treinamento com prazo proximo.",
  },
  {
    key: "lms_overdue",
    label: "LMS: prazo vencido",
    description: "Dispara alerta de treinamento vencido.",
  },
  {
    key: "lms_lesson_question",
    label: "LMS: duvida em aula",
    description: "Dispara para RH/Admin quando uma duvida e registrada.",
  },
  {
    key: "lms_lesson_answer",
    label: "LMS: duvida respondida",
    description: "Dispara para colaborador quando sua duvida recebe resposta.",
  },
  {
    key: "lms_quiz_review",
    label: "LMS: avaliacao para revisar",
    description: "Dispara quando avaliacao discursiva aguarda revisao.",
  },
  {
    key: "lms_quiz_reviewed",
    label: "LMS: avaliacao corrigida",
    description: "Dispara quando avaliacao e corrigida.",
  },
  {
    key: "lms_manual_reminder",
    label: "LMS: lembrete manual",
    description: "Dispara lembrete enviado por gestor/RH.",
  },
  {
    key: "lms_weekly_summary",
    label: "LMS: resumo semanal",
    description: "Dispara resumo semanal de treinamentos.",
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
  { value: "/financeiro/pagamentos-extras", label: "Financeiro - Pagamentos extras" },
  { value: "/rh/solicitacoes", label: "RH - Solicitacoes" },
  { value: "/meu-perfil/chamados", label: "Meu Perfil - Chamados" },
  { value: "/meu-perfil/nota-fiscal", label: "Meu Perfil - Nota fiscal" },
  { value: "/meu-perfil/feedback", label: "Meu Perfil - Feedback" },
  { value: "/meu-perfil/pdi", label: "Meu Perfil - PDI" },
  { value: "/meu-perfil/mapa-comportamental", label: "Meu Perfil - Mapa comportamental" },
  { value: "/meu-perfil/ausencias-programadas", label: "Meu Perfil - Ausencias programadas" },
  { value: "/rh/lgpd", label: "RH - LGPD" },
  { value: "/admin/canal-de-etica", label: "Admin - Canal de etica" },
  { value: "/p-d/chamados", label: "P&D - Chamados" },
  { value: "/agenda/agenda-institucional", label: "Agenda - Institucional" },
  { value: "/lms/meus-treinamentos", label: "LMS - Meus treinamentos" },
  { value: "/rh/lms", label: "RH - LMS" },
];

function emptyDraft(eventKey: string): RuleDraft {
  const notifyActorByDefault =
    eventKey === "project_updated" ||
    eventKey === "deliverable_updated" ||
    eventKey === "pd_deliverable_updated";
  const isAbsenceAllowance = eventKey.startsWith("absence_allowance_");
  const isAbsenceRequest = eventKey.startsWith("absence_request_");
  return {
    event_key: eventKey,
    enabled: true,
    notify_assigned_user: true,
    notify_project_owner: !(isAbsenceAllowance || isAbsenceRequest),
    notify_project_managers: isAbsenceRequest ? true : !isAbsenceAllowance,
    notify_project_coordinators: !(isAbsenceAllowance || isAbsenceRequest),
    notify_actor: notifyActorByDefault || isAbsenceRequest,
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
