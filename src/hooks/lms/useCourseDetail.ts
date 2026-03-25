"use client";

import { useMemo, useState } from "react";
import type { LmsCourseDetail } from "@/lib/lms/types";

export function useCourseDetail(initialDetail: LmsCourseDetail) {
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(initialDetail.modules[0]?.id ?? null);
  const lessons = useMemo(() => initialDetail.modules.flatMap((module) => module.lessons), [initialDetail.modules]);

  return {
    detail: initialDetail,
    lessons,
    expandedModuleId,
    setExpandedModuleId,
  };
}
