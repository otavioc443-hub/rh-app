"use client";

import { useMemo } from "react";
import type { LmsAdminDashboardData } from "@/lib/lms/types";

export function useLmsDashboard(data: LmsAdminDashboardData) {
  const cards = useMemo(
    () => [
      { label: "Cursos", value: data.totalCourses },
      { label: "Publicados", value: data.publishedCourses },
      { label: "Colaboradores", value: data.assignedUsers },
      { label: "Conclusao media", value: `${Math.round(data.averageCompletion)}%` },
      { label: "Vencidos", value: data.overdueTrainings },
      { label: "Atrasados", value: data.delayedUsers },
    ],
    [data],
  );

  return { cards };
}
