"use client";

import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageShell";
import type { LmsGovernanceData } from "@/lib/lms/types";

function actionLabel(action: string) {
  switch (action) {
    case "course_created":
      return "Curso criado";
    case "course_updated":
      return "Curso atualizado";
    case "course_published":
    case "course_published_after_update":
    case "course_published_on_create":
      return "Curso publicado";
    case "course_archived":
      return "Curso arquivado";
    case "course_version_restored":
      return "Versao restaurada";
    case "question_bank_created":
      return "Pergunta adicionada ao banco";
    case "question_bank_deleted":
      return "Pergunta removida do banco";
    case "onboarding_assignments_generated":
      return "Atribuicoes de onboarding geradas";
    default:
      return action;
  }
}

export function LmsGovernanceClient({ data }: { data: LmsGovernanceData }) {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">LMS</span>}
        title="Governanca LMS"
        subtitle="Acompanhe automacoes, rastreabilidade operacional e mudancas relevantes da autoria."
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Leitura operacional</div>
          <h2 className="mt-3 text-2xl font-semibold">O LMS esta pronto para sustentar criacao, recorrencia e comunicacao.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
            Use esta visao para conferir rapidamente se os gatilhos criticos estao ativos e se as trilhas de auditoria ja registram a movimentacao do modulo.
          </p>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Automacoes criticas</div>
          <div className="mt-4 space-y-3">
            {data.automationStatus.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${item.enabled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {item.enabled ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {item.enabled ? "Ativo" : "Pendente"}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-600">{item.helper}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rastreabilidade recente</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Ultimos eventos relevantes do LMS</h2>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ShieldCheck size={18} />
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {data.recentLogs.length ? (
            data.recentLogs.map((row) => (
              <div key={row.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{actionLabel(row.action)}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {row.course_title ? row.course_title : "Evento institucional do LMS"}
                      {row.lesson_title ? ` · ${row.lesson_title}` : ""}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {row.user_name} · {new Date(row.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    <Clock3 size={14} />
                    {row.action}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Ainda nao ha eventos recentes suficientes para exibir nesta linha do tempo.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
