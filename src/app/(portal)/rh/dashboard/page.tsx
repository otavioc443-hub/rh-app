"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, DollarSign, Download, Printer, RefreshCcw, TrendingDown, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ColaboradorRow = {
  id: string;
  nome: string | null;
  is_active: boolean | null;
  data_admissao: string | null;
  data_demissao: string | null;
  salario: number | null;
  departamento: string | null;
  tipo_contrato: string | null;
};

type AbsenceRow = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number | null;
  status: string;
};

type ExtraPaymentRow = {
  id: string;
  amount: number | null;
  status: "pending" | "approved" | "rejected" | "paid";
  reference_month: string | null;
  created_at: string;
};

function parseDateOnly(v: string | null) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPercent(v: number) {
  return `${v.toFixed(1)}%`;
}

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  const needs = /[",\n\r]/.test(s);
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
}

function htmlEscape(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthEnd(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function diffDaysInclusive(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function businessDaysBetween(start: Date, end: Date) {
  let out = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out += 1;
  }
  return out;
}

function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const s = aStart > bStart ? aStart : bStart;
  const e = aEnd < bEnd ? aEnd : bEnd;
  if (e < s) return 0;
  return diffDaysInclusive(s, e);
}

function isActiveOnDate(c: ColaboradorRow, date: Date) {
  const adm = parseDateOnly(c.data_admissao);
  const dem = parseDateOnly(c.data_demissao);
  if (adm && adm > date) return false;
  if (dem && dem < date) return false;
  return true;
}

function Kpi({
  title,
  value,
  subtitle,
  icon: Icon,
  iconSize = 18,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number }>;
  iconSize?: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">{title}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={iconSize} />
        </div>
      </div>
    </div>
  );
}

export default function RhDashboardPage() {
  const now = useMemo(() => new Date(), []);
  const currentStart = useMemo(() => monthStart(now), [now]);
  const currentEnd = useMemo(() => monthEnd(now), [now]);

  const [fromDate, setFromDate] = useState(toISO(currentStart));
  const [toDate, setToDate] = useState(toISO(currentEnd));
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [colabs, setColabs] = useState<ColaboradorRow[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [extras, setExtras] = useState<ExtraPaymentRow[]>([]);
  const [companyName, setCompanyName] = useState("Empresa");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("/logo.png");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const from = parseDateOnly(fromDate);
      const to = parseDateOnly(toDate);
      if (!from || !to || to < from) {
        setMsg("Periodo invalido.");
        setLoading(false);
        return;
      }

      const authRes = await supabase.auth.getUser();
      const uid = authRes.data.user?.id ?? null;
      if (uid) {
        const profileRes = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", uid)
          .maybeSingle<{ company_id: string | null }>();
        const cid = !profileRes.error ? profileRes.data?.company_id ?? null : null;
        if (cid) {
          const companyRes = await supabase
            .from("company")
            .select("name,logo_url")
            .eq("id", cid)
            .maybeSingle<{ name: string | null; logo_url: string | null }>();
          if (!companyRes.error && companyRes.data) {
            setCompanyName((companyRes.data.name ?? "Empresa").trim() || "Empresa");
            setCompanyLogoUrl((companyRes.data.logo_url ?? "").trim() || "/logo.png");
          } else {
            setCompanyName("Empresa");
            setCompanyLogoUrl("/logo.png");
          }
        } else {
          setCompanyName("Empresa");
          setCompanyLogoUrl("/logo.png");
        }
      }

      const [colRes, absRes, extraRes] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("id,nome,is_active,data_admissao,data_demissao,salario,departamento,tipo_contrato")
          .order("nome", { ascending: true }),
        supabase
          .from("absence_requests")
          .select("id,user_id,start_date,end_date,days_count,status")
          .eq("status", "approved")
          .lte("start_date", toDate)
          .gte("end_date", fromDate),
        supabase
          .from("project_extra_payments")
          .select("id,amount,status,reference_month,created_at")
          .gte("reference_month", fromDate)
          .lte("reference_month", toDate),
      ]);

      if (colRes.error) throw new Error(`Colaboradores: ${colRes.error.message}`);

      const nextColabs = (colRes.data ?? []) as ColaboradorRow[];
      setColabs(nextColabs);

      if (absRes.error) {
        setAbsences([]);
        setMsg((prev) => prev || `Ausencias indisponiveis: ${absRes.error.message}`);
      } else {
        setAbsences((absRes.data ?? []) as AbsenceRow[]);
      }

      if (extraRes.error) {
        setExtras([]);
        setMsg((prev) => prev || `Pagamentos extras indisponiveis: ${extraRes.error.message}`);
      } else {
        setExtras((extraRes.data ?? []) as ExtraPaymentRow[]);
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar dashboard de RH.");
      setColabs([]);
      setAbsences([]);
      setExtras([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const from = useMemo(() => parseDateOnly(fromDate) ?? currentStart, [fromDate, currentStart]);
  const to = useMemo(() => parseDateOnly(toDate) ?? currentEnd, [toDate, currentEnd]);

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        colabs
          .map((c) => (c.departamento ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [colabs]);

  const contractOptions = useMemo(() => {
    return Array.from(
      new Set(
        colabs
          .map((c) => (c.tipo_contrato ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [colabs]);

  const filteredColabs = useMemo(() => {
    return colabs.filter((c) => {
      if (departmentFilter !== "all" && (c.departamento ?? "").trim() !== departmentFilter) return false;
      if (contractFilter !== "all" && (c.tipo_contrato ?? "").trim() !== contractFilter) return false;
      return true;
    });
  }, [colabs, departmentFilter, contractFilter]);

  const turnover = useMemo(() => {
    const admissions = filteredColabs.filter((c) => {
      const d = parseDateOnly(c.data_admissao);
      return d && d >= from && d <= to;
    }).length;

    const terminations = filteredColabs.filter((c) => {
      const d = parseDateOnly(c.data_demissao);
      return d && d >= from && d <= to;
    }).length;

    const hcStart = filteredColabs.filter((c) => isActiveOnDate(c, from)).length;
    const hcEnd = filteredColabs.filter((c) => isActiveOnDate(c, to)).length;
    const avgHeadcount = (hcStart + hcEnd) / 2 || 0;
    const rate = avgHeadcount > 0 ? (terminations / avgHeadcount) * 100 : 0;

    return { admissions, terminations, avgHeadcount, rate };
  }, [filteredColabs, from, to]);

  const absenteeism = useMemo(() => {
    const activeAvg = turnover.avgHeadcount;
    const workDays = businessDaysBetween(from, to);
    const approvedDays = absences.reduce((acc, a) => {
      const s = parseDateOnly(a.start_date);
      const e = parseDateOnly(a.end_date);
      if (!s || !e) return acc;
      return acc + overlapDays(s, e, from, to);
    }, 0);
    const denominator = activeAvg * Math.max(1, workDays);
    const rate = denominator > 0 ? (approvedDays / denominator) * 100 : 0;
    return { approvedDays, workDays, rate };
  }, [absences, from, to, turnover.avgHeadcount]);

  const averageTenure = useMemo(() => {
    const active = filteredColabs.filter((c) => Boolean(c.is_active) && !c.data_demissao);
    const years = active
      .map((c) => {
        const adm = parseDateOnly(c.data_admissao);
        if (!adm) return null;
        return (Date.now() - adm.getTime()) / (365.25 * 86400000);
      })
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const avg = years.length ? years.reduce((a, b) => a + b, 0) / years.length : 0;
    return avg;
  }, [filteredColabs]);

  const probation = useMemo(() => {
    const out = filteredColabs
      .filter((c) => Boolean(c.is_active) && !c.data_demissao)
      .map((c) => {
        const adm = parseDateOnly(c.data_admissao);
        if (!adm) return null;
        const days = Math.floor((Date.now() - adm.getTime()) / 86400000);
        const remaining = 90 - days;
        if (remaining < 0) return null;
        return { id: c.id, nome: c.nome ?? "Sem nome", remaining, admissao: c.data_admissao ?? "-" };
      })
      .filter((x): x is { id: string; nome: string; remaining: number; admissao: string } => Boolean(x))
      .sort((a, b) => a.remaining - b.remaining);
    return out;
  }, [filteredColabs]);

  const costs = useMemo(() => {
    const monthlySalary = filteredColabs
      .filter((c) => Boolean(c.is_active) && !c.data_demissao)
      .reduce((acc, c) => acc + (Number(c.salario ?? 0) || 0), 0);

    const months = Math.max(
      1,
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
    );
    const salaryPeriod = monthlySalary * months;

    const extrasPending = extras
      .filter((e) => e.status === "pending")
      .reduce((acc, e) => acc + (Number(e.amount ?? 0) || 0), 0);
    const extrasApproved = extras
      .filter((e) => e.status === "approved")
      .reduce((acc, e) => acc + (Number(e.amount ?? 0) || 0), 0);
    const extrasPaid = extras
      .filter((e) => e.status === "paid")
      .reduce((acc, e) => acc + (Number(e.amount ?? 0) || 0), 0);
    const extrasTotal = extras.reduce((acc, e) => acc + (Number(e.amount ?? 0) || 0), 0);

    return { monthlySalary, salaryPeriod, extrasPending, extrasApproved, extrasPaid, extrasTotal };
  }, [filteredColabs, extras, from, to]);

  const trend = useMemo(() => {
    const points: Array<{ key: string; admissions: number; terminations: number }> = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const last = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const mStart = monthStart(cursor);
      const mEnd = monthEnd(cursor);
      const admissions = filteredColabs.filter((c) => {
        const d = parseDateOnly(c.data_admissao);
        return d && d >= mStart && d <= mEnd;
      }).length;
      const terminations = filteredColabs.filter((c) => {
        const d = parseDateOnly(c.data_demissao);
        return d && d >= mStart && d <= mEnd;
      }).length;
      points.push({ key, admissions, terminations });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const max = Math.max(1, ...points.flatMap((p) => [p.admissions, p.terminations]));
    return { points, max };
  }, [filteredColabs, from, to]);

  function exportCsv() {
    const lines: string[] = [];
    lines.push(["secao", "campo", "valor"].map(csvEscape).join(","));
    lines.push(["filtro", "de", fromDate].map(csvEscape).join(","));
    lines.push(["filtro", "ate", toDate].map(csvEscape).join(","));
    lines.push(["filtro", "departamento", departmentFilter].map(csvEscape).join(","));
    lines.push(["filtro", "tipo_contrato", contractFilter].map(csvEscape).join(","));
    lines.push(["kpi", "turnover_percent", turnover.rate.toFixed(2)].map(csvEscape).join(","));
    lines.push(["kpi", "absenteismo_percent", absenteeism.rate.toFixed(2)].map(csvEscape).join(","));
    lines.push(["kpi", "tempo_medio_anos", averageTenure.toFixed(2)].map(csvEscape).join(","));
    lines.push(["kpi", "probatorio_qtd", probation.length].map(csvEscape).join(","));
    lines.push(["kpi", "folha_mensal", costs.monthlySalary.toFixed(2)].map(csvEscape).join(","));
    lines.push(["kpi", "extras_total", costs.extrasTotal.toFixed(2)].map(csvEscape).join(","));
    lines.push(["kpi", "extras_pagos", costs.extrasPaid.toFixed(2)].map(csvEscape).join(","));

    lines.push("");
    lines.push(["probatorio", "nome", "admissao", "dias_restantes"].map(csvEscape).join(","));
    for (const p of probation) {
      lines.push(["row", p.nome, p.admissao, p.remaining].map(csvEscape).join(","));
    }

    lines.push("");
    lines.push(["movimento_mensal", "mes", "admissoes", "desligamentos"].map(csvEscape).join(","));
    for (const p of trend.points) {
      lines.push(["row", p.key, p.admissions, p.terminations].map(csvEscape).join(","));
    }

    const filename = `rh_dashboard_${fromDate}_${toDate}.csv`;
    downloadTextFile(filename, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportPdf() {
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Dashboard RH</title>
          <style>
            body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
            .header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
            .header img{height:40px;max-width:180px;object-fit:contain}
            h1{margin:0 0 8px 0;font-size:20px}
            p{margin:0 0 12px 0;font-size:12px;color:#475569}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:12px;text-align:left}
            th{background:#f8fafc}
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${htmlEscape(companyLogoUrl)}" alt="Logo ${htmlEscape(companyName)}" />
            <div>
              <div style="font-size:13px;font-weight:700">${htmlEscape(companyName)}</div>
              <div style="font-size:11px;color:#64748b">Relatorio RH</div>
            </div>
          </div>
          <h1>Dashboard RH</h1>
          <p>Periodo: ${fromDate} ate ${toDate} | Departamento: ${departmentFilter} | Contrato: ${contractFilter}</p>
          <table>
            <tr><th>KPI</th><th>Valor</th></tr>
            <tr><td>Turnover</td><td>${fmtPercent(turnover.rate)}</td></tr>
            <tr><td>Absenteismo</td><td>${fmtPercent(absenteeism.rate)}</td></tr>
            <tr><td>Tempo medio</td><td>${averageTenure.toFixed(1)} anos</td></tr>
            <tr><td>Em probatorio</td><td>${probation.length}</td></tr>
            <tr><td>Folha mensal</td><td>${fmtMoney(costs.monthlySalary)}</td></tr>
            <tr><td>Extras no periodo</td><td>${fmtMoney(costs.extrasTotal)}</td></tr>
          </table>
        </body>
      </html>
    `;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Dashboard RH</h1>
            <p className="mt-1 text-sm text-slate-600">
              Indicadores de turnover, absenteismo, tempo de empresa, probatorio e custos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportCsv()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Download size={16} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => exportPdf()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Printer size={16} />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            De
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Ate
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Departamento
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Tipo contrato
            <select
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              {contractOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {msg ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{msg}</div> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          title="Turnover"
          value={fmtPercent(turnover.rate)}
          subtitle={`${turnover.terminations} desligamentos`}
          icon={TrendingDown}
        />
        <Kpi
          title="Absenteismo"
          value={fmtPercent(absenteeism.rate)}
          subtitle={`${absenteeism.approvedDays} dias aprovados`}
          icon={CalendarRange}
        />
        <Kpi
          title="Tempo medio"
          value={`${averageTenure.toFixed(1)} anos`}
          subtitle="colaboradores ativos"
          icon={Users}
        />
        <Kpi
          title="Probatorio"
          value={String(probation.length)}
          subtitle="ate 90 dias de admissao"
          icon={Users}
        />
        <Kpi
          title="Folha mensal"
          value={fmtMoney(costs.monthlySalary)}
          subtitle="ativos no filtro"
          icon={DollarSign}
          iconSize={16}
        />
        <Kpi
          title="Extras periodo"
          value={fmtMoney(costs.extrasTotal)}
          subtitle={`pago: ${fmtMoney(costs.extrasPaid)}`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">Movimento mensal (admissoes x desligamentos)</div>
          <div className="mt-4 grid grid-cols-6 gap-3">
            {trend.points.map((p) => {
              const hIn = Math.round((p.admissions / trend.max) * 100);
              const hOut = Math.round((p.terminations / trend.max) * 100);
              return (
                <div key={p.key} className="flex flex-col items-center gap-2">
                  <div className="relative h-28 w-full max-w-[64px] rounded-xl bg-slate-100">
                    <div className="absolute bottom-0 left-0 right-1 rounded-xl bg-emerald-500/85" style={{ height: hIn }} />
                    <div className="absolute bottom-0 right-0 left-1 rounded-xl bg-rose-500/80" style={{ height: hOut }} />
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700">{p.key.slice(5)}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/85" /> Admissoes
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/80" /> Desligamentos
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">Custos do periodo</div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-slate-600">Folha estimada no periodo</span>
              <b className="text-slate-900">{fmtMoney(costs.salaryPeriod)}</b>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-slate-600">Extras pendentes</span>
              <b className="text-slate-900">{fmtMoney(costs.extrasPending)}</b>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-slate-600">Extras aprovados</span>
              <b className="text-slate-900">{fmtMoney(costs.extrasApproved)}</b>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-slate-600">Extras pagos</span>
              <b className="text-slate-900">{fmtMoney(costs.extrasPaid)}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-900">Colaboradores em periodo probatorio (90 dias)</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Admissao</th>
                <th className="p-3">Dias restantes</th>
              </tr>
            </thead>
            <tbody>
              {probation.length ? (
                probation.slice(0, 20).map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-medium text-slate-900">{p.nome}</td>
                    <td className="p-3 text-slate-700">{p.admissao}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        {p.remaining} dia(s)
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={3}>
                    Nenhum colaborador em periodo probatorio no filtro atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
