"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, Bookmark, GraduationCap, Medal } from "lucide-react";
import { BadgeShelf } from "@/components/lms/BadgeShelf";
import { CourseCard } from "@/components/lms/CourseCard";
import { EmptyState } from "@/components/lms/EmptyState";
import { PageHeader } from "@/components/ui/PageShell";
import { certificatesService } from "@/lib/lms/certificatesService";
import type { LmsLearnerCertificateItem, LmsGamificationOverview, LmsMyTrainingCard } from "@/lib/lms/types";

export function LmsLearnerJourneyClient({
  trainings,
  certificates,
  gamification,
}: {
  trainings: LmsMyTrainingCard[];
  certificates: LmsLearnerCertificateItem[];
  gamification: LmsGamificationOverview;
}) {
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = JSON.parse(window.localStorage.getItem("lms:saved-courses") ?? "[]") as string[];
    setSavedIds(current);
  }, []);

  const savedCourses = useMemo(
    () => trainings.filter((item) => savedIds.includes(item.course.id)),
    [savedIds, trainings],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">LMS</span>}
        title="Minha jornada"
        subtitle="Acompanhe tudo o que você já conquistou, salvou para depois e pode retomar com mais facilidade."
      />

      <section className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Panorama pessoal</div>
              <h2 className="mt-3 text-2xl font-semibold">Seu centro de aprendizagem e reconhecimento.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                Aqui ficam seus certificados, conquistas do LMS e os cursos que você marcou para retomar com mais calma.
              </p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <GraduationCap size={20} />
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Salvos</div>
              <div className="mt-2 text-2xl font-semibold">{savedCourses.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Certificados</div>
              <div className="mt-2 text-2xl font-semibold">{certificates.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Badges</div>
              <div className="mt-2 text-2xl font-semibold">{gamification.badges.length}</div>
            </div>
          </div>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Retomada rápida</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Voltar para o que importa agora</h2>
          <div className="mt-4 space-y-3">
            <Link href="/lms/meus-treinamentos" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              Ver meus treinamentos
              <span>→</span>
            </Link>
            <Link href="/lms/conquistas" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              Abrir minhas conquistas
              <span>→</span>
            </Link>
            <Link href="/lms/ranking" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              Conferir ranking da temporada
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Salvar para depois</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Cursos que você marcou para voltar</h2>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Bookmark size={18} />
          </span>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {savedCourses.length ? (
            savedCourses.map((item) => <CourseCard key={item.course.id} item={item} />)
          ) : (
            <div className="xl:col-span-3">
              <EmptyState
                title="Nenhum curso salvo ainda"
                description="Quando você usar 'Salvar para depois' em um treinamento, ele aparecerá aqui."
              />
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Certificados emitidos</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Comprovantes da sua evolução</h2>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Award size={18} />
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {certificates.length ? (
              certificates.map((certificate) => (
                <div key={certificate.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-950">{certificate.course_title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Emitido em {new Date(certificate.issued_at).toLocaleDateString("pt-BR")} · Código {certificate.validation_code}
                  </div>
                  <button
                    type="button"
                    onClick={() => certificatesService.open(certificate.course_id)}
                    className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                  >
                    Baixar certificado
                  </button>
                </div>
              ))
            ) : (
              <EmptyState
                title="Nenhum certificado disponível"
                description="Assim que um curso elegível for concluído, o comprovante aparecerá aqui."
              />
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Reconhecimento</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Conquistas e badges do seu ritmo de aprendizagem</h2>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Medal size={18} />
            </span>
          </div>
          <div className="mt-4">
            <BadgeShelf items={gamification.badges} title="Badges desbloqueados" subtitle="Marcos por consistência, desempenho e domínio do conteúdo." />
          </div>
        </div>
      </section>
    </div>
  );
}
