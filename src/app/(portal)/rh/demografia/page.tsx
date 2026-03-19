"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Collaborator = {
  id: string;
  nome: string | null;
  is_active: boolean | null;
  data_nascimento: string | null;
  sexo: string | null;
  estado_civil: string | null;
  tipo_contrato: string | null;
  departamento: string | null;
  setor: string | null;
  salario: number | null;
  data_admissao: string | null;
};

function parseDate(v: string | null) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
}

function ageFromBirth(v: string | null) {
  const d = parseDate(v);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function tenureYears(v: string | null) {
  const d = parseDate(v);
  if (!d) return null;
  const ms = Date.now() - d.getTime();
  return ms / (365.25 * 86400000);
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

function Kpi({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DistributionChartCard({
  title,
  rows,
  emptyText = "Sem dados.",
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  emptyText?: string;
}) {
  const total = rows.reduce((acc, row) => acc + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 space-y-3">
        {rows.length ? (
          rows.map((row) => {
            const width = (row.count / max) * 100;
            const pct = total > 0 ? (row.count / total) * 100 : 0;
            return (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{row.label}</span>
                  <span className="font-semibold text-slate-900">
                    {row.count} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(3, width)}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function PieChartCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}) {
  const palette = [
    "#0f172a",
    "#1d4ed8",
    "#0891b2",
    "#0f766e",
    "#65a30d",
    "#ca8a04",
    "#ea580c",
    "#dc2626",
    "#7c3aed",
    "#be185d",
  ];
  const total = rows.reduce((acc, row) => acc + row.count, 0);
  const normalized = rows
    .filter((x) => x.count > 0)
    .map((x, index) => ({ ...x, color: palette[index % palette.length] }));
  const slices = normalized.reduce<Array<{ label: string; count: number; color: string; start: number; end: number }>>(
    (acc, row) => {
      const lastEnd = acc.length ? acc[acc.length - 1].end : 0;
      const sweep = (row.count / Math.max(1, total)) * 360;
      return [...acc, { ...row, start: lastEnd, end: lastEnd + sweep }];
    },
    []
  );
  const stops = slices.map((slice) => `${slice.color} ${slice.start}deg ${slice.end}deg`).join(", ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {normalized.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="flex items-center justify-center">
            <div
              className="h-44 w-44 rounded-full border border-slate-200"
              style={{ background: `conic-gradient(${stops})` }}
              aria-label="grafico pizza"
            />
          </div>
          <div className="space-y-2">
            {normalized.map((row) => {
              const pct = total > 0 ? (row.count / total) * 100 : 0;
              return (
                <div key={row.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="text-slate-700">{row.label}</span>
                  </div>
                  <b className="text-slate-900">
                    {row.count} ({pct.toFixed(1)}%)
                  </b>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sem dados.</p>
      )}
    </div>
  );
}

function ColumnChartCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {rows.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => {
            const h = Math.round((row.count / max) * 100);
            return (
              <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex h-28 items-end rounded-lg bg-white p-2">
                  <div className="w-full rounded-md bg-slate-900" style={{ height: `${Math.max(8, h)}%` }} />
                </div>
                <div className="mt-2 truncate text-xs font-semibold text-slate-700" title={row.label}>
                  {row.label}
                </div>
                <div className="text-sm font-bold text-slate-900">{row.count}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sem dados.</p>
      )}
    </div>
  );
}

export default function RhDemografiaPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<Collaborator[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [costCenterMode, setCostCenterMode] = useState<"departamento" | "setor">("departamento");
  const [companyName, setCompanyName] = useState("Empresa");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("/logo.png");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const authRes = await supabase.auth.getUser();
      const uid = authRes.data.user?.id ?? null;

      const [colRes, profileRes] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("id,nome,is_active,data_nascimento,sexo,estado_civil,tipo_contrato,departamento,setor,salario,data_admissao")
          .order("nome", { ascending: true }),
        uid
          ? supabase.from("profiles").select("company_id").eq("id", uid).maybeSingle<{ company_id: string | null }>()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (colRes.error) throw new Error(colRes.error.message);
      setRows((colRes.data ?? []) as Collaborator[]);

      const cid = !profileRes.error ? profileRes.data?.company_id ?? null : null;
      if (cid) {
        const cRes = await supabase
          .from("company")
          .select("name,logo_url")
          .eq("id", cid)
          .maybeSingle<{ name: string | null; logo_url: string | null }>();
        if (!cRes.error && cRes.data) {
          setCompanyName((cRes.data.name ?? "Empresa").trim() || "Empresa");
          setCompanyLogoUrl((cRes.data.logo_url ?? "").trim() || "/logo.png");
        }
      }
    } catch (e: unknown) {
      setRows([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar dashboard demografico.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => (r.departamento ?? "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [rows]
  );
  const contractOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => (r.tipo_contrato ?? "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (departmentFilter !== "all" && (r.departamento ?? "").trim() !== departmentFilter) return false;
        if (contractFilter !== "all" && (r.tipo_contrato ?? "").trim() !== contractFilter) return false;
        return true;
      }),
    [rows, departmentFilter, contractFilter]
  );

  const active = useMemo(() => filtered.filter((r) => Boolean(r.is_active)), [filtered]);
  const avgAge = useMemo(() => {
    const ages = active.map((r) => ageFromBirth(r.data_nascimento)).filter((v): v is number => v !== null);
    if (!ages.length) return 0;
    return ages.reduce((a, b) => a + b, 0) / ages.length;
  }, [active]);
  const avgTenure = useMemo(() => {
    const yrs = active.map((r) => tenureYears(r.data_admissao)).filter((v): v is number => v !== null);
    if (!yrs.length) return 0;
    return yrs.reduce((a, b) => a + b, 0) / yrs.length;
  }, [active]);

  const byGender = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of active) {
      const key = (r.sexo ?? "Nao informado").trim() || "Nao informado";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([label, count]) => ({ label, count }));
  }, [active]);

  const byCivil = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of active) {
      const key = (r.estado_civil ?? "Nao informado").trim() || "Nao informado";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([label, count]) => ({ label, count }));
  }, [active]);

  const byContract = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of active) {
      const key = (r.tipo_contrato ?? "Nao informado").trim() || "Nao informado";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([label, count]) => ({ label, count }));
  }, [active]);

  const bySector = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of active) {
      const key = (r.setor ?? "Nao informado").trim() || "Nao informado";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [active]);

  const ageBands = useMemo(() => {
    const bands = [
      { key: "ate_25", label: "Até 25", count: 0 },
      { key: "26_35", label: "26-35", count: 0 },
      { key: "36_45", label: "36-45", count: 0 },
      { key: "46_55", label: "46-55", count: 0 },
      { key: "56_plus", label: "56+", count: 0 },
      { key: "na", label: "Não informado", count: 0 },
    ];
    for (const r of active) {
      const age = ageFromBirth(r.data_nascimento);
      if (age === null) {
        bands[5].count += 1;
      } else if (age <= 25) {
        bands[0].count += 1;
      } else if (age <= 35) {
        bands[1].count += 1;
      } else if (age <= 45) {
        bands[2].count += 1;
      } else if (age <= 55) {
        bands[3].count += 1;
      } else {
        bands[4].count += 1;
      }
    }
    return bands;
  }, [active]);

  const tenureBands = useMemo(() => {
    const bands = [
      { key: "ate_1", label: "Ate 1 ano", count: 0 },
      { key: "1_3", label: "1 a 3 anos", count: 0 },
      { key: "3_5", label: "3 a 5 anos", count: 0 },
      { key: "5_plus", label: "Mais de 5 anos", count: 0 },
      { key: "na", label: "Nao informado", count: 0 },
    ];
    for (const r of active) {
      const years = tenureYears(r.data_admissao);
      if (years === null) {
        bands[4].count += 1;
      } else if (years <= 1) {
        bands[0].count += 1;
      } else if (years <= 3) {
        bands[1].count += 1;
      } else if (years <= 5) {
        bands[2].count += 1;
      } else {
        bands[3].count += 1;
      }
    }
    return bands;
  }, [active]);

  const costsByCenter = useMemo(() => {
    const keyOf = (r: Collaborator) => {
      if (costCenterMode === "setor") {
        return (r.setor ?? "").trim() || "Nao informado";
      }
      return (r.departamento ?? "").trim() || "Nao informado";
    };
    const m = new Map<string, number>();
    for (const r of active) {
      const key = keyOf(r);
      const salary = Number(r.salario ?? 0) || 0;
      m.set(key, (m.get(key) ?? 0) + salary);
    }
    const rows = Array.from(m.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((acc, r) => acc + r.amount, 0);
    return { rows, total };
  }, [active, costCenterMode]);

  function exportCsv() {
    const lines: string[] = [];
    lines.push(["secao", "chave", "valor"].map(csvEscape).join(","));
    lines.push(["kpi", "colaboradores_ativos", active.length].map(csvEscape).join(","));
    lines.push(["kpi", "idade_media", avgAge.toFixed(1)].map(csvEscape).join(","));
    lines.push(["kpi", "tempo_medio_empresa_anos", avgTenure.toFixed(1)].map(csvEscape).join(","));
    for (const r of byGender) lines.push(["genero", r.label, r.count].map(csvEscape).join(","));
    for (const r of byCivil) lines.push(["estado_civil", r.label, r.count].map(csvEscape).join(","));
    for (const r of byContract) lines.push(["tipo_contrato", r.label, r.count].map(csvEscape).join(","));
    for (const r of ageBands) lines.push(["faixa_etaria", r.label, r.count].map(csvEscape).join(","));
    downloadTextFile(`rh_demografia_${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportPdf() {
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Dashboard Demografico RH</title>
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
          <h1>Dashboard Demografico RH</h1>
          <p>Departamento: ${htmlEscape(departmentFilter === "all" ? "Todos" : departmentFilter)} | Contrato: ${htmlEscape(contractFilter === "all" ? "Todos" : contractFilter)}</p>
          <table>
            <tr><th>Indicador</th><th>Valor</th></tr>
            <tr><td>Colaboradores ativos</td><td>${htmlEscape(active.length)}</td></tr>
            <tr><td>Idade media</td><td>${htmlEscape(avgAge.toFixed(1))}</td></tr>
            <tr><td>Tempo medio de empresa (anos)</td><td>${htmlEscape(avgTenure.toFixed(1))}</td></tr>
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
            <h1 className="text-xl font-semibold text-slate-900">Dashboard Demografico RH</h1>
            <p className="mt-1 text-sm text-slate-600">Distribuicao de perfil dos colaboradores por idade, genero, contrato e estrutura organizacional.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              <Download size={16} /> Exportar CSV
            </button>
            <button type="button" onClick={exportPdf} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              <Printer size={16} /> Exportar PDF
            </button>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Departamento
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
              <option value="all">Todos</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Tipo de contrato
            <select value={contractFilter} onChange={(e) => setContractFilter(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi title="Colaboradores ativos" value={String(active.length)} subtitle="No filtro atual" />
        <Kpi title="Idade media" value={`${avgAge.toFixed(1)} anos`} subtitle="Com base em data de nascimento" />
        <Kpi title="Tempo medio de empresa" value={`${avgTenure.toFixed(1)} anos`} subtitle="Com base na admissao" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionChartCard title="Distribuicao por genero" rows={byGender} />
        <DistributionChartCard title="Distribuicao por estado civil" rows={byCivil} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PieChartCard title="Setores" rows={bySector} />
        <ColumnChartCard title="Setores (colunas)" rows={bySector.slice(0, 8)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Gastos por centro de custo (folha mensal ativa)</p>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setCostCenterMode("departamento")}
                className={`rounded-lg px-2.5 py-1 font-semibold ${
                  costCenterMode === "departamento" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                Departamento
              </button>
              <button
                type="button"
                onClick={() => setCostCenterMode("setor")}
                className={`rounded-lg px-2.5 py-1 font-semibold ${
                  costCenterMode === "setor" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                Setor
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {costsByCenter.rows.length ? (
              costsByCenter.rows.map((r) => {
                const pct = costsByCenter.total > 0 ? (r.amount / costsByCenter.total) * 100 : 0;
                return (
                  <div key={r.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800">{r.label}</span>
                      <span className="font-semibold text-slate-900">{fmtMoney(r.amount)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                    <div className="mt-1 text-right text-xs text-slate-500">{pct.toFixed(1)}%</div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">Sem dados de salario para calcular centro de custo.</p>
            )}
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="text-slate-600">Total considerado:</span>{" "}
            <b className="text-slate-900">{fmtMoney(costsByCenter.total)}</b>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DistributionChartCard title="Distribuicao por tipo de contrato" rows={byContract} />
        <DistributionChartCard title="Faixa etaria" rows={ageBands.map((x) => ({ label: x.label, count: x.count }))} />
        <DistributionChartCard title="Faixa de tempo de empresa" rows={tenureBands.map((x) => ({ label: x.label, count: x.count }))} />
      </div>
    </div>
  );
}

