"use client";

import { useMemo, useState } from "react";

export function useLearningPaths<T extends { title: string; status: string }>(initialRows: T[]) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return initialRows;
    return initialRows.filter((row) => row.title.toLowerCase().includes(normalized));
  }, [initialRows, search]);

  return { search, setSearch, rows };
}
