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
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title="Meus treinamentos" subtitle="Continue estudando com foco no que importa agora." />
      <section className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Continue assistindo</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Retome sua proxima aula</h2>
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
        <div className="overflow-hidden rounded-[30px] border border-slate-800 bg-[linear-gradient(135deg,#111111_0%,#1f1f1f_100%)] p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Sua jornada no LMS</div>
              <h2 className="mt-3 text-2xl font-semibold">Pouco ruido, foco no que importa.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
                Acompanhe sua fila de cursos sem excesso de informacao: avance, conclua e volte quando quiser.
              </p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <GraduationCap size={20} />
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/55">Em andamento</div>
              <div className="mt-2 text-2xl font-semibold">{inProgress}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/55">Concluidos</div>
              <div className="mt-2 text-2xl font-semibold">{completed}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/55">Pendencias</div>
              <div className="mt-2 text-2xl font-semibold">{overdue}</div>
            </div>
          </div>
        </div>
      </section>

      <LMSFilters search={search} onSearchChange={setSearch} status={status} onStatusChange={setStatus} />
      {overdue ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          <span className="inline-flex items-center gap-2 font-semibold"><Clock3 size={16} /> Existem treinamentos com prazo vencido ou critico na sua fila.</span>
        </div>
      ) : null}
      {items.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Catalogo pessoal</div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Cursos atribuidos a voce</h2>
            </div>
            <Link href="/lms/minha-jornada" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
              Ver jornada completa
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <CourseCard key={item.course.id} item={item} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState title="Nenhum treinamento encontrado" description="Ajuste os filtros ou aguarde novas atribuicoes do RH." />
      )}
    </div>
  );
}
