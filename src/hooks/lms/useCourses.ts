"use client";

import { useMemo, useState } from "react";
import type { LmsCourseWithCounts } from "@/lib/lms/types";

export function useCourses(initialCourses: LmsCourseWithCounts[]) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filteredCourses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return initialCourses.filter((course) => {
      if (status !== "all" && course.status !== status) return false;
      if (!normalizedSearch) return true;
      return [course.title, course.category, course.short_description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalizedSearch));
    });
  }, [initialCourses, search, status]);

  return { search, setSearch, status, setStatus, filteredCourses };
}
