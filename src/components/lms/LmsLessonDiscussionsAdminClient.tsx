"use client";

import { useMemo, useState } from "react";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import type { LmsLessonDiscussionAdminRow } from "@/lib/lms/types";

export function LmsLessonDiscussionsAdminClient({ rows }: { rows: LmsLessonDiscussionAdminRow[] }) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      `${row.author_name ?? ""} ${row.course_title} ${row.lesson_title} ${row.message}`.toLowerCase().includes(normalized),
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">QA</span>}
        title="Duvidas das aulas"
        subtitle="Acompanhe perguntas enviadas pelos colaboradores durante o consumo dos treinamentos."
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por colaborador, curso, aula ou conteudo da duvida"
          className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
        />
      </div>

      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Colaborador</th>
                <th className="px-6 py-3">Curso</th>
                <th className="px-6 py-3">Aula</th>
                <th className="px-6 py-3">Duvida</th>
                <th className="px-6 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{row.author_name ?? "Colaborador"}</div>
                      {row.author_role ? <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{row.author_role}</div> : null}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{row.course_title}</td>
                    <td className="px-6 py-4 text-slate-700">{row.lesson_title}</td>
                    <td className="px-6 py-4 text-slate-700">{row.message}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.created_at))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    Nenhuma duvida registrada nas aulas ate o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </TableShell>
    </div>
  );
}
