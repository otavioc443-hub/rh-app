"use client";

import { useMemo, useState } from "react";
import type { LmsMyTrainingCard } from "@/lib/lms/types";

export function useMyTrainings(initialTrainings: LmsMyTrainingCard[]) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const items = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return initialTrainings.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!normalized) return true;
      return [item.course.title, item.course.category, item.course.short_description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalized));
    });
  }, [initialTrainings, search, status]);

  return { search, setSearch, status, setStatus, items };
}
