"use client";

import { useMemo, useState } from "react";
import type { LmsTeamTrainingRow } from "@/lib/lms/types";

export function useTeamTrainings(initialRows: LmsTeamTrainingRow[]) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "overdue" | "due_soon" | "in_progress" | "completed">("all");

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return initialRows.filter((row) => {
      if (status !== "all" && row.status !== status && row.urgency !== status) return false;
      if (!normalized) return true;
      return `${row.full_name} ${row.course_title} ${row.department_name ?? ""}`.toLowerCase().includes(normalized);
    });
  }, [initialRows, search, status]);

  return { search, setSearch, status, setStatus, rows };
}
