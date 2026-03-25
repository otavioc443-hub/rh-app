"use client";

import { PageHeader } from "@/components/ui/PageShell";
import { CourseCard } from "@/components/lms/CourseCard";
import { EmptyState } from "@/components/lms/EmptyState";
import { LMSFilters } from "@/components/lms/LMSFilters";
import { useMyTrainings } from "@/hooks/lms/useMyTrainings";
import type { LmsMyTrainingCard } from "@/lib/lms/types";

export function MyTrainingsClient({ trainings }: { trainings: LmsMyTrainingCard[] }) {
  const { search, setSearch, status, setStatus, items } = useMyTrainings(trainings);

  return (
    <div className="space-y-6">
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title="Meus treinamentos" subtitle="Acompanhe prazos, consumo e certificados do seu desenvolvimento corporativo." />
      <LMSFilters search={search} onSearchChange={setSearch} status={status} onStatusChange={setStatus} />
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
