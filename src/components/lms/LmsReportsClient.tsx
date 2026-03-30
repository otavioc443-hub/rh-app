"use client";

import { useMemo, useState } from "react";
import { Download, TrendingDown, TrendingUp, Users2 } from "lucide-react";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import type { LmsReportRow } from "@/lib/lms/types";

export function LmsReportsClient({ rows }: { rows: LmsReportRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [course, setCourse] = useState("all");
  const [role, setRole] = useState("all");
  const departments = useMemo(() => Array.from(new Set(rows.map((row) => row.department_name).filter(Boolean))).sort(), [rows]);
  const courses = useMemo(() => Array.from(new Set(rows.map((row) => row.course_title).filter(Boolean))).sort(), [rows]);
  const roles = useMemo(() => Array.from(new Set(rows.map((row) => row.role).filter(Boolean))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !normalized || `${row.user_name} ${row.course_title} ${row.department_name ?? ""} ${row.role ?? ""}`.toLowerCase().includes(normalized);
      const matchesStatus = status === "all" || row.status === status;
      const matchesDepartment = department === "all" || row.department_name === department;
      const matchesCourse = course === "all" || row.course_title === course;
      const matchesRole = role === "all" || row.role === role;
      return matchesSearch && matchesStatus && matchesDepartment && matchesCourse && matchesRole;
    });
  }, [course, department, role, rows, search, status]);

  const executive = useMemo(() => {
    const averageProgress = filteredRows.length
      ? Math.round(filteredRows.reduce((sum, row) => sum + row.progress_percent, 0) / filteredRows.length)
      : 0;
    const completed = filteredRows.filter((row) => row.status === "completed").length;
    const overdue = filteredRows.filter((row) => row.status === "overdue").length;
    const departments = new Map<string, { total: number; completed: number }>();
    for (const row of filteredRows) {
      const key = row.department_name ?? "Sem departamento";
      const current = departments.get(key) ?? { total: 0, completed: 0 };
      current.total += 1;
      if (row.status === "completed") current.completed += 1;
      departments.set(key, current);
    }
    const rankedDepartments = Array.from(departments.entries())
      .map(([department, stats]) => ({
        department,
        completionRate: stats.total ? Math.round((stats.completed / stats.total) * 100) : 0,
      }))
      .sort((left, right) => right.completionRate - left.completionRate);

    return {
      averageProgress,
      completed,
      overdue,
      strongestDepartment: rankedDepartments[0] ?? null,
      weakestDepartment: rankedDepartments.at(-1) ?? null,
    };
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title="Relatorios LMS" subtitle="Conclusao por curso, area e desempenho em avaliacoes." />
      <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Leitura executiva</div>
          <h2 className="mt-3 text-2xl font-semibold">Resumo rapido para acompanhar adesao, conclusao e risco.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
            Esses indicadores ajudam o RH a entender onde o aprendizado esta fluindo bem e onde convem agir com cobranca, apoio ou ajuste de conteudo.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Progresso medio</div>
              <div className="mt-2 text-2xl font-semibold">{executive.averageProgress}%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Concluidos</div>
              <div className="mt-2 text-2xl font-semibold">{executive.completed}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Em atraso</div>
              <div className="mt-2 text-2xl font-semibold">{executive.overdue}</div>
            </div>
          </div>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Comparativo entre areas</div>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700"><TrendingUp size={14} /> Melhor desempenho</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{executive.strongestDepartment?.department ?? "Sem dados"}</div>
              <div className="mt-1 text-sm text-slate-600">{executive.strongestDepartment?.completionRate ?? 0}% de conclusao</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700"><TrendingDown size={14} /> Maior oportunidade</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{executive.weakestDepartment?.department ?? "Sem dados"}</div>
              <div className="mt-1 text-sm text-slate-600">{executive.weakestDepartment?.completionRate ?? 0}% de conclusao</div>
            </div>
          </div>
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por colaborador, curso ou area" className="h-11 flex-1 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
          <option value="all">Todos os status</option>
          <option value="not_started">Nao iniciado</option>
          <option value="in_progress">Em andamento</option>
          <option value="completed">Concluido</option>
          <option value="overdue">Em atraso</option>
        </select>
        <select value={department} onChange={(event) => setDepartment(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
          <option value="all">Todas as areas</option>
          {departments.map((item) => (
            <option key={item} value={item ?? ""}>{item}</option>
          ))}
        </select>
        <select value={course} onChange={(event) => setCourse(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
          <option value="all">Todos os cursos</option>
          {courses.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={role} onChange={(event) => setRole(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
          <option value="all">Todos os perfis</option>
          {roles.map((item) => (
            <option key={item} value={item ?? ""}>{item}</option>
          ))}
        </select>
        <a href={`/api/lms/admin/reports/export?status=${encodeURIComponent(status)}&department=${encodeURIComponent(department)}&course=${encodeURIComponent(course)}&role=${encodeURIComponent(role)}`} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          <Download size={16} />
          Exportar CSV
        </a>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><Users2 size={16} /> Registros filtrados</div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{filteredRows.length}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><TrendingUp size={16} /> Aproveitamento medio</div>
          <div className="mt-2 text-3xl font-bold text-emerald-600">{executive.averageProgress}%</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><TrendingDown size={16} /> Registros em atraso</div>
          <div className="mt-2 text-3xl font-bold text-rose-600">{executive.overdue}</div>
        </div>
      </div>
      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Colaborador</th>
                <th className="px-6 py-3">Perfil</th>
                <th className="px-6 py-3">Departamento</th>
                <th className="px-6 py-3">Curso</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Progresso</th>
                <th className="px-6 py-3">Nota</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`${row.user_name}-${row.course_title}-${index}`} className="border-t border-slate-100">
                  <td className="px-6 py-4 font-medium text-slate-900">{row.user_name}</td>
                  <td className="px-6 py-4 text-slate-600">{row.role ?? "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{row.department_name ?? "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{row.course_title}</td>
                  <td className="px-6 py-4 text-slate-600">{row.status}</td>
                  <td className="px-6 py-4 text-slate-600">{Math.round(row.progress_percent)}%</td>
                  <td className="px-6 py-4 text-slate-600">{row.score ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </TableShell>
    </div>
  );
}
