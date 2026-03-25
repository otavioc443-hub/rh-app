"use client";

import { useMemo, useState } from "react";
import type { LmsTeamTrainingRow } from "@/lib/lms/types";

export function useTeamTrainings(initialRows: LmsTeamTrainingRow[]) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return initialRows;
    return initialRows.filter((row) => `${row.full_name} ${row.course_title}`.toLowerCase().includes(normalized));
  }, [initialRows, search]);

  return { search, setSearch, rows };
}
