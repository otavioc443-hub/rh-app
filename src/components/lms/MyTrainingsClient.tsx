"use client";

import Link from "next/link";
import { Award, Clock3, GraduationCap, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/PageShell";
import { CourseCard } from "@/components/lms/CourseCard";
import { EmptyState } from "@/components/lms/EmptyState";
import { LMSFilters } from "@/components/lms/LMSFilters";
import { useMyTrainings } from "@/hooks/lms/useMyTrainings";
import type { LmsMyTrainingCard } from "@/lib/lms/types";

export function MyTrainingsClient({ trainings }: { trainings: LmsMyTrainingCard[] }) {
  const { search, setSearch, status, setStatus, items } = useMyTrainings(trainings);
  const inProgress = trainings.filter((item) => item.status === "in_progress").length;
  const completed = trainings.filter((item) => item.status === "completed").length;
  const overdue = trainings.filter((item) => item.status === "overdue").length;
  const continueItem = trainings
    .filter((item) => item.status === "in_progress" && (item.progress?.progress_percent ?? 0) > 0)
    .sort((left, right) => (right.progress?.progress_percent ?? 0) - (left.progress?.progress_percent ?? 0))[0];

  return (
    <div className="space-y-6">
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title="Meus treinamentos" subtitle="Acompanhe prazos, consumo e certificados do seu desenvolvimento corporativo." />
      <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Sua jornada no LMS</div>
              <h2 className="mt-3 text-2xl font-semibold">Retome com clareza e acompanhe seus marcos.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                Aqui voce encontra os treinamentos em andamento, os prazos que pedem atencao e os cursos ja concluidos com certificado.
              </p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <GraduationCap size={20} />
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Em andamento</div>
              <div className="mt-2 text-2xl font-semibold">{inProgress}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Concluidos</div>
              <div className="mt-2 text-2xl font-semibold">{completed}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Pendencias</div>
              <div className="mt-2 text-2xl font-semibold">{overdue}</div>
            </div>
          </div>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Acao recomendada</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Continue de onde voce parou</h2>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Sparkles size={18} />
            </span>
          </div>
          {continueItem ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">{continueItem.course.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  {continueItem.course.short_description ?? "Seu proximo passo esta pronto para retomada rapida."}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white px-3 py-1">{Math.round(continueItem.progress?.progress_percent ?? 0)}% concluido</span>
                  <span className="rounded-full bg-white px-3 py-1">{continueItem.assignment?.due_date ? `Prazo ${continueItem.assignment.due_date}` : "Sem prazo"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/lms/cursos/${continueItem.course.id}`} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                  Continuar treinamento
                </Link>
                <Link href="/lms/minha-jornada" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-2"><Award size={16} /> Ver jornada</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              Assim que voce iniciar um treinamento, esta area passa a mostrar a retomada mais importante do momento.
            </div>
          )}
        </div>
      </section>

      <LMSFilters search={search} onSearchChange={setSearch} status={status} onStatusChange={setStatus} />
      {overdue ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          <span className="inline-flex items-center gap-2 font-semibold"><Clock3 size={16} /> Existem treinamentos com prazo vencido ou critico na sua fila.</span>
        </div>
      ) : null}
      {items.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <CourseCard key={item.course.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum treinamento encontrado" description="Ajuste os filtros ou aguarde novas atribuicoes do RH." />
      )}
    </div>
  );
}
