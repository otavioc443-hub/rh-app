"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Briefcase, Building2, Download, Monitor, RefreshCcw, Shield, TrendingDown, TrendingUp, Maximize } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { PageHelpModal } from "@/components/ui/PageHelpModal";

type WindowKey = "30" | "90" | "180" | "365" | "all";

type ProjectRow = {
  id: string;
  name: string;
  status: string | null;
  budget_total: number | null;
  client_id: string | null;
  company_id: string | null;
  project_type?: string | null;
  project_line?: "eolica" | "solar" | "bess" | null;
  created_at: string;
};
type ClientRow = { id: string; name: string; company_id: string | null };
type BulletinRow = {
  id: string;
  project_id: string;
  amount_total: number | null;
  paid_amount: number | null;
  status: string | null;
  expected_payment_date: string | null;
  paid_at: string | null;
  created_at: string | null;
};
type ExtraRow = { id: string; project_id: string; amount: number | null; status: string | null; created_at: string | null };
type IndirectRow = {
  id: string;
  project_id: string;
  cost_type: "monthly" | "one_time" | "percentage_payroll" | null;
  amount: number | null;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
};
type ProjectMemberRow = { project_id: string; user_id: string; member_role: string };
type CollaboratorRow = { id: string; user_id: string | null; nome?: string | null; salario: number | null; is_active: boolean | null };
type ContractEventRow = { id: string; project_id: string; status: string; additional_amount: number | null; created_at: string };
type ProfileMiniRow = { id: string; full_name: string | null; email: string | null; company_id?: string | null };

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pct(v: number) {
  return `${v.toFixed(1)}%`;
}
function csvCell(v: string | number) {
  const s = String(v ?? "");
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}
function isEmailLike(value: string) {
  return value.includes("@");
}

function parseNoteTag(notes: string | null | undefined, key: string) {
  const src = String(notes ?? "");
  const marker = `${key}=`;
  const start = src.indexOf(marker);
  if (start < 0) return "";
  const tail = src.slice(start + marker.length);
  const end = tail.indexOf(" | ");
  const value = (end >= 0 ? tail.slice(0, end) : tail).trim();
  return value;
}

function parseIndirectCollaboratorName(notes: string | null | undefined) {
  const source = parseNoteTag(notes, "Fonte");
  if (!source.toLowerCase().startsWith("colaborador:")) return "";
  return source.slice("colaborador:".length).trim();
}

function isIntegralSingleProjectIndirect(notes: string | null | undefined) {
  return parseNoteTag(notes, "Rateio").toLowerCase() === "integral (projeto unico)";
}

function isLegacyAbsolutePercentageValue(amount: number) {
  return amount > 100;
}

function monthKeyFromDate(dateLike: string | null | undefined) {
  const d = new Date(dateLike ?? "");
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function StatCard({
  title,
  value,
  subtitle,
  tone,
  trend,
  helpText,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "pink" | "amber" | "blue" | "emerald";
  trend?: { text: string; positive: boolean };
  helpText?: string;
}) {
  const toneMap = {
    pink: "from-fuchsia-500 to-pink-600",
    amber: "from-amber-400 to-yellow-500",
    blue: "from-indigo-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
  } as const;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cx("mb-4 h-2 rounded-full bg-gradient-to-r", toneMap[tone])} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600">{title}</p>
        {helpText ? <InfoTooltip title={title} body={[helpText]} /> : null}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
      {trend ? (
        <span
          className={cx(
            "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            trend.positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          )}
        >
          {trend.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend.text}
        </span>
      ) : null}
    </div>
  );
}

export default function CeoPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { loading: roleLoading, role, active } = useUserRole();
  const canAccess = active && (role === "admin" || role === "diretoria");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<WindowKey>("90");
  const [clientFilter, setClientFilter] = useState<"all" | string>("all");
  const [analysis, setAnalysis] = useState<"faturamento" | "margem">("faturamento");
  const [monthlyChartMode] = useState<"mensal" | "acumulado">("mensal");
  const [compactMode, setCompactMode] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [tvRefreshSeconds, setTvRefreshSeconds] = useState<30 | 60 | 120>(60);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTvControls, setShowTvControls] = useState(true);
  const [tvRotateClients, setTvRotateClients] = useState(false);
  const [tvRotateAnalysis, setTvRotateAnalysis] = useState(false);
  const [tvRotateWindow, setTvRotateWindow] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tvCycleSeconds, setTvCycleSeconds] = useState<10 | 20 | 30>(20);
  const [showPageHelp, setShowPageHelp] = useState(false);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRow[]>([]);
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [indirects, setIndirects] = useState<IndirectRow[]>([]);
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [collabs, setCollabs] = useState<CollaboratorRow[]>([]);
  const [aditivos, setAditivos] = useState<ContractEventRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMiniRow[]>([]);

  const downloadCsv = (fileName: string, header: string[], rows: Array<Array<string | number>>) => {
    const content = [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    async function load() {
      if (!canAccess) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setMsg("");
      try {
        const { data: sess } = await supabase.auth.getSession();
        const meId = sess.session?.user?.id;
        if (!meId) throw new Error("Usuario nao autenticado.");
        const profRes = await supabase.from("profiles").select("company_id").eq("id", meId).maybeSingle();
        if (profRes.error) throw new Error(profRes.error.message);
        const cId = (profRes.data?.company_id as string | null | undefined) ?? null;
        setCompanyId(cId);

        const [pRes, cRes, bRes, eRes, iRes, mRes, colRes, aRes, prRes] = await Promise.all([
          supabase.from("projects").select("id,name,status,budget_total,client_id,company_id,project_type,project_line,created_at"),
          supabase.from("project_clients").select("id,name,company_id"),
          supabase.from("project_measurement_bulletins").select("id,project_id,amount_total,paid_amount,status,expected_payment_date,paid_at,created_at"),
          supabase.from("project_extra_payments").select("id,project_id,amount,status,created_at"),
          supabase.from("project_indirect_costs").select("id,project_id,cost_type,amount,notes,start_date,end_date,created_at"),
          supabase.from("project_members").select("project_id,user_id,member_role"),
          supabase.from("colaboradores").select("id,user_id,nome,salario,is_active"),
          supabase.from("project_contract_events").select("id,project_id,status,additional_amount,created_at,event_type").eq("event_type", "aditivo_valor"),
          supabase.from("profiles").select("id,full_name,email,company_id"),
        ]);
        if (pRes.error || cRes.error || bRes.error || eRes.error || iRes.error || mRes.error || colRes.error || aRes.error || prRes.error) {
          throw new Error(
            pRes.error?.message ||
              cRes.error?.message ||
              bRes.error?.message ||
              eRes.error?.message ||
              iRes.error?.message ||
              mRes.error?.message ||
              colRes.error?.message ||
              aRes.error?.message ||
              prRes.error?.message ||
              "Erro ao carregar dados."
          );
        }
        setProjects((pRes.data ?? []) as ProjectRow[]);
        setClients((cRes.data ?? []) as ClientRow[]);
        setBulletins((bRes.data ?? []) as BulletinRow[]);
        setExtras((eRes.data ?? []) as ExtraRow[]);
        setIndirects((iRes.data ?? []) as IndirectRow[]);
        setMembers((mRes.data ?? []) as ProjectMemberRow[]);
        setCollabs((colRes.data ?? []) as CollaboratorRow[]);
        setProfiles((prRes.data ?? []) as ProfileMiniRow[]);
        setAditivos(((aRes.data ?? []) as Array<ContractEventRow & { event_type: string }>).map((row) => ({
          id: row.id,
          project_id: row.project_id,
          status: row.status,
          additional_amount: row.additional_amount,
          created_at: row.created_at,
        })));
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Erro ao carregar painel.");
      } finally {
        setUpdatedAt(new Date());
        setLoading(false);
      }
    }
    void load();
  }, [canAccess]);

  useEffect(() => {
    if (!tvMode || !canAccess) return;
    const id = window.setInterval(() => {
      window.location.reload();
    }, tvRefreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [tvMode, canAccess, tvRefreshSeconds]);

  useEffect(() => {
    if (!tvMode) {
      setShowTvControls(true);
      return;
    }
    let hideTimer: number | null = null;
    const reset = () => {
      setShowTvControls(true);
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setShowTvControls(false), 5000);
    };
    reset();
    window.addEventListener("mousemove", reset);
    window.addEventListener("click", reset);
    window.addEventListener("keydown", reset);
    return () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("click", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [tvMode]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const isTvRoute = pathname === "/ceo-tv";
      const tvParam = searchParams.get("tv");
      const compactParam = searchParams.get("compact");
      const refreshParam = searchParams.get("refresh");
      const savedCompact = window.localStorage.getItem("ceo_dashboard_compact_mode");
      const savedRefresh = window.localStorage.getItem("ceo_dashboard_tv_refresh_seconds");
      const savedRotate = window.localStorage.getItem("ceo_dashboard_tv_rotate_clients");
      const savedRotateAnalysis = window.localStorage.getItem("ceo_dashboard_tv_rotate_analysis");
      const savedRotateWindow = window.localStorage.getItem("ceo_dashboard_tv_rotate_window");
      const savedCycle = window.localStorage.getItem("ceo_dashboard_tv_cycle_seconds");
      // No painel CEO normal, nao reaplica tvMode salvo (o controle fica na tela dedicada /ceo-tv).
      const finalTv = isTvRoute ? "1" : tvParam === "1" ? "1" : tvParam === "0" ? "0" : "0";
      const finalCompact = isTvRoute ? "1" : compactParam === "1" ? "1" : compactParam === "0" ? "0" : savedCompact;
      const finalRefresh = refreshParam ?? savedRefresh;
      if (finalTv === "1") setTvMode(true);
      if (finalCompact === "1") setCompactMode(true);
      if (finalRefresh === "30" || finalRefresh === "60" || finalRefresh === "120") {
        setTvRefreshSeconds(Number(finalRefresh) as 30 | 60 | 120);
      }
      if (savedRotate === "1") setTvRotateClients(true);
      if (savedRotateAnalysis === "1") setTvRotateAnalysis(true);
      if (savedRotateWindow === "1") setTvRotateWindow(true);
      if (savedCycle === "10" || savedCycle === "20" || savedCycle === "30") {
        setTvCycleSeconds(Number(savedCycle) as 10 | 20 | 30);
      }
    } catch {
      // no-op
    }
  }, [searchParams, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("ceo_dashboard_tv_mode", tvMode ? "1" : "0");
      window.localStorage.setItem("ceo_dashboard_compact_mode", compactMode ? "1" : "0");
      window.localStorage.setItem("ceo_dashboard_tv_refresh_seconds", String(tvRefreshSeconds));
      window.localStorage.setItem("ceo_dashboard_tv_rotate_clients", tvRotateClients ? "1" : "0");
      window.localStorage.setItem("ceo_dashboard_tv_rotate_analysis", tvRotateAnalysis ? "1" : "0");
      window.localStorage.setItem("ceo_dashboard_tv_rotate_window", tvRotateWindow ? "1" : "0");
      window.localStorage.setItem("ceo_dashboard_tv_cycle_seconds", String(tvCycleSeconds));
    } catch {
      // no-op
    }
  }, [tvMode, compactMode, tvRefreshSeconds, tvRotateClients, tvRotateAnalysis, tvRotateWindow, tvCycleSeconds]);

  const startDate = useMemo(() => {
    if (windowKey === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(windowKey));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [windowKey]);

  const inWindow = useCallback((dateLike: string | null | undefined) => {
    if (!startDate) return true;
    const d = new Date(dateLike ?? "");
    return !Number.isNaN(d.getTime()) && d >= startDate;
  }, [startDate]);

  const scopedProjects = useMemo(() => {
    return projects.filter((p) => {
      if (companyId && p.company_id && p.company_id !== companyId) return false;
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      return true;
    });
  }, [projects, companyId, clientFilter]);

  const projectIds = useMemo(() => new Set(scopedProjects.map((p) => p.id)), [scopedProjects]);
  const scopedBulletins = useMemo(() => bulletins.filter((b) => projectIds.has(b.project_id)), [bulletins, projectIds]);
  const scopedExtras = useMemo(() => extras.filter((x) => projectIds.has(x.project_id)), [extras, projectIds]);
  const scopedIndirects = useMemo(() => indirects.filter((x) => projectIds.has(x.project_id)), [indirects, projectIds]);
  const scopedAditivos = useMemo(() => aditivos.filter((x) => projectIds.has(x.project_id)), [aditivos, projectIds]);

  const salaryByCollaboratorName = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of collabs) {
      if (c.is_active !== true) continue;
      const name = String(c.nome ?? "").trim().toLowerCase();
      if (!name) continue;
      map.set(name, Number(c.salario || 0));
    }
    return map;
  }, [collabs]);

  const resolveIndirectValue = useCallback((row: IndirectRow) => {
    const amount = Number(row.amount || 0);
    if (amount <= 0) return 0;
    if (row.cost_type !== "percentage_payroll") return amount;
    if (isLegacyAbsolutePercentageValue(amount)) return amount;
    const collaboratorName = parseIndirectCollaboratorName(row.notes);
    const salary = collaboratorName ? (salaryByCollaboratorName.get(collaboratorName.toLowerCase()) ?? 0) : 0;
    if (salary <= 0) return 0;
    return isIntegralSingleProjectIndirect(row.notes) || scopedProjects.filter((p) => p.status === "active").length <= 1
      ? salary
      : salary * (amount / 100);
  }, [salaryByCollaboratorName, scopedProjects]);

  const receivedNow = useMemo(
    () =>
      scopedBulletins
        .filter((b) => (b.status === "pago" || Number(b.paid_amount || 0) > 0) && inWindow(b.paid_at ?? b.created_at))
        .reduce((acc, b) => acc + Math.max(0, Number(b.paid_amount || (b.status === "pago" ? b.amount_total || 0 : 0))), 0),
    [scopedBulletins, inWindow]
  );
  const forecastOpen = useMemo(
    () =>
      scopedBulletins
        .filter((b) => b.status !== "cancelado" && inWindow(b.expected_payment_date ?? b.created_at))
        .reduce((acc, b) => acc + Math.max(0, Number(b.amount_total || 0) - Number(b.paid_amount || 0)), 0),
    [scopedBulletins, inWindow]
  );
  const directCost = useMemo(
    () =>
      scopedExtras
        .filter((x) => (x.status === "approved" || x.status === "paid") && inWindow(x.created_at))
        .reduce((acc, x) => acc + Number(x.amount || 0), 0),
    [scopedExtras, inWindow]
  );
  const indirectCost = useMemo(
    () =>
      scopedIndirects
        .filter((x) => {
          const ref = x.cost_type === "one_time" ? x.created_at : x.start_date ?? x.created_at;
          return inWindow(ref);
        })
        .reduce((acc, x) => acc + resolveIndirectValue(x), 0),
    [scopedIndirects, inWindow, resolveIndirectValue]
  );
  const payroll = useMemo(() => {
    const allowedRoles = new Set(["gestor", "coordenador", "colaborador"]);
    const ids = new Set<string>();
    for (const m of members) {
      if (!projectIds.has(m.project_id)) continue;
      if (!allowedRoles.has(m.member_role)) continue;
      ids.add(m.user_id);
    }
    let sum = 0;
    for (const c of collabs) {
      if (c.is_active !== true) continue;
      const id = c.user_id ?? c.id;
      if (!id || !ids.has(id)) continue;
      sum += Number(c.salario || 0);
    }
    return sum;
  }, [members, collabs, projectIds]);
  const marginValue = receivedNow - (directCost + indirectCost + payroll);
  const marginPct = receivedNow > 0 ? (marginValue / receivedNow) * 100 : 0;
  const indirectByProjectTotal = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of scopedIndirects) {
      map.set(row.project_id, (map.get(row.project_id) ?? 0) + resolveIndirectValue(row));
    }
    return map;
  }, [scopedIndirects, resolveIndirectValue]);
  const activeProjects = scopedProjects.filter((p) => p.status === "active").length;
  const lineDistribution = useMemo(
    () => ({
      eolica: scopedProjects.filter((p) => p.project_line === "eolica").length,
      solar: scopedProjects.filter((p) => p.project_line === "solar").length,
      bess: scopedProjects.filter((p) => p.project_line === "bess").length,
    }),
    [scopedProjects]
  );
  const modalityDistribution = useMemo(
    () => ({
      basico: scopedProjects.filter((p) => p.project_type === "basico").length,
      executivo: scopedProjects.filter((p) => p.project_type === "executivo").length,
      eng_do_proprietario: scopedProjects.filter((p) => p.project_type === "eng_do_proprietario").length,
      consultoria: scopedProjects.filter((p) => p.project_type === "consultoria").length,
    }),
    [scopedProjects]
  );
  const scopedTotal = Math.max(1, scopedProjects.length);
  const shareLabel = (count: number) => `${count} (${pct((count / scopedTotal) * 100)})`;
  const pendingAditivos = scopedAditivos.filter((a) => a.status === "em_analise" || a.status === "registrado");
  const pendingAditivosValue = pendingAditivos.reduce((acc, a) => acc + Number(a.additional_amount || 0), 0);
  const overdueBulletins = scopedBulletins.filter((b) => b.status === "atrasado").length;

  const prevReceived = useMemo(() => {
    if (windowKey === "all") return 0;
    const days = Number(windowKey);
    const end = new Date();
    end.setDate(end.getDate() - days);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    return scopedBulletins.reduce((acc, b) => {
      if (!(b.status === "pago" || Number(b.paid_amount || 0) > 0)) return acc;
      const d = new Date(b.paid_at ?? b.created_at ?? "");
      if (Number.isNaN(d.getTime())) return acc;
      if (d >= start && d < end) return acc + Math.max(0, Number(b.paid_amount || (b.status === "pago" ? b.amount_total || 0 : 0)));
      return acc;
    }, 0);
  }, [scopedBulletins, windowKey]);
  const receivedTrend = prevReceived > 0 ? ((receivedNow - prevReceived) / prevReceived) * 100 : receivedNow > 0 ? 100 : 0;

  const monthlySeries = useMemo(() => {
    const now = new Date();
    const rows: Array<{ label: string; key: string; current: number; previous: number }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${d.getFullYear()}-${mm}`;
      rows.push({ label: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][d.getMonth()], key, current: 0, previous: 0 });
    }
    for (const b of scopedBulletins) {
      const paid = Math.max(0, Number(b.paid_amount || (b.status === "pago" ? b.amount_total || 0 : 0)));
      if (!paid) continue;
      const base = new Date(b.paid_at ?? b.created_at ?? "");
      if (Number.isNaN(base.getTime())) continue;
      const k = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
      const idx = rows.findIndex((r) => r.key === k);
      if (idx >= 0) rows[idx].current += paid;
      const prevIdx = rows.findIndex((r) => {
        const [y, m] = r.key.split("-").map(Number);
        return y - 1 === base.getFullYear() && m === base.getMonth() + 1;
      });
      if (prevIdx >= 0) rows[prevIdx].previous += paid;
    }
    return rows;
  }, [scopedBulletins]);
  const monthlySeriesAccumulated = useMemo(() => {
    let currentAcc = 0;
    let previousAcc = 0;
    return monthlySeries.map((m) => {
      currentAcc += m.current;
      previousAcc += m.previous;
      return { ...m, current: currentAcc, previous: previousAcc };
    });
  }, [monthlySeries]);
  const marginMonthlySeries = useMemo(() => {
    return monthlySeries.map((m) => {
      const [y, mo] = m.key.split("-").map(Number);
      const extrasMonth = scopedExtras
        .filter((x) => {
          const d = new Date(x.created_at ?? "");
          return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() + 1 === mo && (x.status === "approved" || x.status === "paid");
        })
        .reduce((acc, x) => acc + Number(x.amount || 0), 0);
      const indirectMonth = scopedIndirects
        .filter((x) => {
          if (x.cost_type === "one_time" || (x.cost_type === "percentage_payroll" && isLegacyAbsolutePercentageValue(Number(x.amount || 0)))) {
            return monthKeyFromDate(x.created_at) === m.key;
          }
          const startKey = monthKeyFromDate(x.start_date ?? x.created_at);
          const endKey = monthKeyFromDate(x.end_date ?? x.start_date ?? x.created_at);
          if (!startKey) return false;
          const effectiveEndKey = endKey || startKey;
          return m.key >= startKey && m.key <= effectiveEndKey;
        })
        .reduce((acc, x) => acc + resolveIndirectValue(x), 0);
      const monthlyPayroll = payroll; // proxy mensal atual para leitura executiva
      const cost = extrasMonth + indirectMonth + monthlyPayroll;
      const margin = m.current - cost;
      const marginPercent = m.current > 0 ? (margin / m.current) * 100 : 0;
      return { ...m, cost, margin, marginPercent };
    });
  }, [monthlySeries, scopedExtras, scopedIndirects, payroll, resolveIndirectValue]);

  const topProjects = useMemo(() => {
    const rows = scopedProjects.map((p) => {
      const pb = scopedBulletins.filter((b) => b.project_id === p.id);
      const received = pb.reduce((acc, b) => acc + Math.max(0, Number(b.paid_amount || (b.status === "pago" ? b.amount_total || 0 : 0))), 0);
      const extrasPending = scopedExtras.filter((x) => x.project_id === p.id && x.status === "pending").reduce((acc, x) => acc + Number(x.amount || 0), 0);
      const ind = indirectByProjectTotal.get(p.id) ?? 0;
      const budget = Number(p.budget_total || 0);
      const margin = budget > 0 ? ((budget - (extrasPending + ind)) / budget) * 100 : 0;
      const receiptRate = budget > 0 ? (received / budget) * 100 : 0;
      return { id: p.id, name: p.name, received, margin, receiptRate };
    });
    rows.sort((a, b) => (analysis === "faturamento" ? b.received - a.received : a.margin - b.margin));
    return rows.slice(0, 8);
  }, [scopedProjects, scopedBulletins, scopedExtras, indirectByProjectTotal, analysis]);

  const monthlyChartSeries = monthlyChartMode === "mensal" ? monthlySeries : monthlySeriesAccumulated;
  const maxMonth = Math.max(1, ...monthlyChartSeries.map((x) => Math.max(x.current, x.previous)));
  const maxMonthCurrent = Math.max(1, ...monthlyChartSeries.map((x) => x.current));
  const maxTop = Math.max(1, ...topProjects.map((x) => (analysis === "faturamento" ? x.received : Math.abs(x.margin))));
  const topClients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; received: number; openForecast: number; projects: number }>();
    for (const p of scopedProjects) {
      if (!p.client_id) continue;
      const pb = scopedBulletins.filter((b) => b.project_id === p.id);
      const received = pb.reduce((acc, b) => acc + Math.max(0, Number(b.paid_amount || (b.status === "pago" ? b.amount_total || 0 : 0))), 0);
      const openForecast = pb.reduce((acc, b) => acc + Math.max(0, Number(b.amount_total || 0) - Number(b.paid_amount || 0)), 0);
      const prev = map.get(p.client_id) ?? {
        id: p.client_id,
        name: clients.find((c) => c.id === p.client_id)?.name ?? "Cliente",
        received: 0,
        openForecast: 0,
        projects: 0,
      };
      prev.received += received;
      prev.openForecast += openForecast;
      prev.projects += 1;
      map.set(p.client_id, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.received - a.received).slice(0, 5);
  }, [scopedProjects, scopedBulletins, clients]);
  const maxTopClient = Math.max(1, ...topClients.map((c) => c.received));
  const profileLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of profiles) {
      const full = p.full_name?.trim() || "";
      m[p.id] = full && !isEmailLike(full) ? full : "Usuario sem nome";
    }
    return m;
  }, [profiles]);
  const collabNameByUserId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of collabs) {
      const uid = (c.user_id ?? "").trim();
      const nome = (c.nome ?? "").trim();
      if (!uid) continue;
      if (nome && !isEmailLike(nome)) m[uid] = nome;
    }
    return m;
  }, [collabs]);
  const topGestores = useMemo(() => {
    const managerRoles = new Set(["gestor", "coordenador"]);
    const rows = new Map<string, { userId: string; nome: string; projetos: number; faturamento: number; margemMedia: number[] }>();
    for (const m of members) {
      if (!projectIds.has(m.project_id) || !managerRoles.has(m.member_role)) continue;
      const project = scopedProjects.find((p) => p.id === m.project_id);
      if (!project) continue;
      const pb = scopedBulletins.filter((b) => b.project_id === m.project_id);
      const received = pb.reduce((acc, b) => acc + Math.max(0, Number(b.paid_amount || (b.status === "pago" ? b.amount_total || 0 : 0))), 0);
      const pendExtras = scopedExtras.filter((x) => x.project_id === m.project_id && x.status === "pending").reduce((acc, x) => acc + Number(x.amount || 0), 0);
      const ind = scopedIndirects.filter((x) => x.project_id === m.project_id).reduce((acc, x) => acc + Number(x.amount || 0), 0);
      const budget = Number(project.budget_total || 0);
      const margin = budget > 0 ? ((budget - (pendExtras + ind)) / budget) * 100 : 0;
      const prev = rows.get(m.user_id) ?? {
        userId: m.user_id,
        nome: profileLabelById[m.user_id] && profileLabelById[m.user_id] !== "Usuario sem nome"
          ? profileLabelById[m.user_id]
          : (collabNameByUserId[m.user_id] ?? "Usuario sem nome"),
        projetos: 0,
        faturamento: 0,
        margemMedia: [],
      };
      prev.projetos += 1;
      prev.faturamento += received;
      prev.margemMedia.push(margin);
      rows.set(m.user_id, prev);
    }
    return Array.from(rows.values())
      .map((r) => ({
        ...r,
        margem: r.margemMedia.length ? r.margemMedia.reduce((a, b) => a + b, 0) / r.margemMedia.length : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 5);
  }, [members, projectIds, scopedProjects, scopedBulletins, scopedExtras, scopedIndirects, profileLabelById, collabNameByUserId]);
  const isStandaloneTvRoute = pathname === "/ceo-tv";
  const tvClientRotationList = useMemo(
    () => clients.filter((c) => !companyId || !c.company_id || c.company_id === companyId).map((c) => c.id),
    [clients, companyId]
  );

  useEffect(() => {
    if (!tvMode) return;
    const enabledSteps = [
      tvRotateClients ? "client" : null,
      tvRotateAnalysis ? "analysis" : null,
      tvRotateWindow ? "window" : null,
    ].filter(Boolean) as Array<"client" | "analysis" | "window">;
    if (enabledSteps.length === 0) return;
    let stepIndex = 0;
    const id = window.setInterval(() => {
      const step = enabledSteps[stepIndex % enabledSteps.length];
      if (step === "client" && tvClientRotationList.length > 0) {
        setClientFilter((prev) => {
          if (prev === "all") return tvClientRotationList[0] ?? "all";
          const currentIdx = tvClientRotationList.indexOf(prev);
          if (currentIdx < 0) return tvClientRotationList[0] ?? "all";
          const nextIdx = currentIdx + 1;
          return nextIdx >= tvClientRotationList.length ? "all" : tvClientRotationList[nextIdx];
        });
      }
      if (step === "analysis") {
        setAnalysis((prev) => (prev === "faturamento" ? "margem" : "faturamento"));
      }
      if (step === "window") {
        const sequence: Array<WindowKey> = ["30", "90", "180"];
        setWindowKey((prev) => {
          const idx = sequence.indexOf(prev);
          return sequence[(idx + 1 + sequence.length) % sequence.length] ?? "90";
        });
      }
      stepIndex += 1;
    }, tvCycleSeconds * 1000);
    return () => window.clearInterval(id);
  }, [tvMode, tvRotateClients, tvRotateAnalysis, tvRotateWindow, tvClientRotationList, tvCycleSeconds]);
  const executiveAlerts = useMemo(() => {
    const alerts: Array<{ level: "alta" | "media" | "baixa"; title: string; detail: string }> = [];
    if (pendingAditivos.length > 0) {
      alerts.push({
        level: pendingAditivos.length >= 3 || pendingAditivosValue > 50000 ? "alta" : "media",
        title: "Aditivos pendentes de aprovacao CEO",
        detail: `${pendingAditivos.length} item(ns), total ${money(pendingAditivosValue)}.`,
      });
    }
    if (overdueBulletins > 0) {
      alerts.push({
        level: overdueBulletins >= 3 ? "alta" : "media",
        title: "Boletins com atraso",
        detail: `${overdueBulletins} boletim(ns) marcados como atrasado.`,
      });
    }
    if (marginPct < 0) {
      alerts.push({ level: "alta", title: "Margem negativa no recorte", detail: `Margem estimada ${pct(marginPct)}.` });
    } else if (marginPct < 15) {
      alerts.push({ level: "media", title: "Margem comprimida", detail: `Margem estimada ${pct(marginPct)}.` });
    }
    if (forecastOpen > receivedNow && receivedNow > 0) {
      alerts.push({
        level: "baixa",
        title: "Carteira com recebimento futuro relevante",
        detail: `Aberto ${money(forecastOpen)} acima do recebido ${money(receivedNow)} no recorte.`,
      });
    }
    return alerts.sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.level] - { alta: 0, media: 1, baixa: 2 }[b.level]));
  }, [pendingAditivos.length, pendingAditivosValue, overdueBulletins, marginPct, forecastOpen, receivedNow]);
  const hasPreviousYearMonthlyBase = useMemo(() => monthlySeries.some((m) => m.previous > 0), [monthlySeries]);

  if (roleLoading || loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Carregando painel CEO...</div>;
  }
  if (!canAccess) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Sem permissao para acessar o painel CEO.</div>;
  }

  return (
    <div className={cx("space-y-6", isStandaloneTvRoute && "text-[15px]")}>
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 p-5 text-white">
        <div className="grid gap-4 xl:grid-cols-[72px_1fr]">
          <div className="hidden xl:flex xl:flex-col xl:items-center xl:justify-between xl:rounded-2xl xl:border xl:border-white/10 xl:bg-white/5 xl:p-3">
            <div className="flex flex-col gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white"><Shield size={18} /></span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-blue-100"><LineIcon /></span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-blue-100"><Building2 size={18} /></span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-blue-100"><Briefcase size={18} /></span>
            </div>
            <div className="text-center text-[10px] leading-tight text-blue-200/80">
              Atualizado
              <br />
              <span className="text-xs font-semibold text-white">
                {(updatedAt ?? new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">CEO / Diretoria</p>
              {tvMode ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-rose-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-300 animate-pulse" />
                  Live
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Performance da empresa</h1>
            <p className="mt-1 text-sm text-blue-100/90">Visao executiva inspirada em painel gerencial, com foco em caixa, margem e decisoes criticas.</p>
          </div>
          <div className={cx("flex items-center gap-2 transition-opacity", tvMode && !showTvControls && "pointer-events-none opacity-0")}>
            <Link href="/home" className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">
              Home
            </Link>
            {!isStandaloneTvRoute ? (
              <>
                <Link href="/ceo/aditivos-contratuais" className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">
                  Aprovar aditivos
                </Link>
              </>
            ) : null}
            {tvMode ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (document.fullscreenElement) {
                      await document.exitFullscreen();
                    } else {
                      await document.documentElement.requestFullscreen();
                    }
                  } catch {
                    // sem suporte/permissao
                  }
                }}
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                  isFullscreen ? "border-white/20 bg-white text-slate-900" : "border-white/20 bg-white/10 hover:bg-white/15"
                )}
                title="Alternar tela cheia"
              >
                <Maximize size={15} />
                {isFullscreen ? "Sair tela cheia" : "Tela cheia"}
              </button>
            ) : null}
            {isStandaloneTvRoute ? (
            <button
              type="button"
              onClick={() => {
                setTvMode((v) => {
                  const next = !v;
                  if (next) setCompactMode(true);
                  return next;
                });
              }}
              className={cx(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                tvMode ? "border-white/20 bg-white text-slate-900" : "border-white/20 bg-white/10 hover:bg-white/15"
              )}
              title="Modo TV: menos controles e atualização automática a cada 60s"
            >
              <Monitor size={15} />
              {tvMode ? "Sair modo TV" : "Modo TV"}
            </button>
            ) : null}
            <button
              type="button"
              onClick={() => setCompactMode((v) => !v)}
              className={cx(
                "rounded-xl border px-3 py-2 text-sm font-semibold",
                compactMode ? "border-white/20 bg-white text-slate-900" : "border-white/20 bg-white/10 hover:bg-white/15"
              )}
            >
              {compactMode ? "Modo completo" : "Modo reuniao"}
            </button>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `ceo-painel-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Bloco", "Indicador", "Valor"],
                  [
                    ["Resumo", "Faturamento recebido", receivedNow],
                    ["Resumo", "Margem bruta estimada", marginValue],
                    ["Resumo", "Margem %", marginPct.toFixed(2)],
                    ["Resumo", "Receita prevista aberta", forecastOpen],
                    ["Resumo", "Aditivos pendentes", pendingAditivos.length],
                    ["Resumo", "Valor aditivos pendentes", pendingAditivosValue],
                    ...topProjects.map((p) => ["Ranking projetos", `${p.name} | % receb./orçado`, `${money(p.received)} | ${pct(p.receiptRate)}`]),
                    ...topClients.map((c) => ["Top clientes", c.name, `${money(c.received)} | aberto ${money(c.openForecast)}`]),
                  ]
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
            >
              <Download size={15} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => setShowPageHelp(true)}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Ajuda da pagina
            </button>
            <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              <RefreshCcw size={15} />
              Atualizar
            </button>
          </div>
        </div>

        {tvMode ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-blue-100/90">
            <div className={cx("flex flex-wrap items-center justify-between gap-3 transition-opacity", !showTvControls && "pointer-events-none opacity-20")}>
              <span>Modo TV ativo: atualização automática e controles reduzidos para leitura em monitor.</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Refresh</span>
                  <select
                    value={tvRefreshSeconds}
                    onChange={(e) => setTvRefreshSeconds(Number(e.target.value) as 30 | 60 | 120)}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-white"
                  >
                    <option className="text-slate-900" value={30}>30s</option>
                    <option className="text-slate-900" value={60}>60s</option>
                    <option className="text-slate-900" value={120}>120s</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Ciclo</span>
                  <select
                    value={tvCycleSeconds}
                    onChange={(e) => setTvCycleSeconds(Number(e.target.value) as 10 | 20 | 30)}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-white"
                  >
                    <option className="text-slate-900" value={10}>10s</option>
                    <option className="text-slate-900" value={20}>20s</option>
                    <option className="text-slate-900" value={30}>30s</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tvRotateClients}
                    onChange={(e) => setTvRotateClients(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Rotacionar clientes</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tvRotateAnalysis}
                    onChange={(e) => setTvRotateAnalysis(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Rotacionar analise</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tvRotateWindow}
                    onChange={(e) => setTvRotateWindow(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Rotacionar janela</span>
                </label>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white">
                  {(updatedAt ?? new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                {!isStandaloneTvRoute ? (
                  <Link
                    href="/ceo/painel-tv-config"
                    className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15"
                  >
                    Presets TV
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!tvMode ? (
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Janela</label>
            <select value={windowKey} onChange={(e) => setWindowKey(e.target.value as WindowKey)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white">
              <option className="text-slate-900" value="30">30 dias</option>
              <option className="text-slate-900" value="90">90 dias</option>
              <option className="text-slate-900" value="180">180 dias</option>
              <option className="text-slate-900" value="365">365 dias</option>
              <option className="text-slate-900" value="all">Historico</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Cliente</label>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white">
              <option className="text-slate-900" value="all">Todos clientes</option>
              {clients.filter((c) => !companyId || !c.company_id || c.company_id === companyId).map((c) => (
                <option key={c.id} className="text-slate-900" value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Analise do ranking</label>
            <select value={analysis} onChange={(e) => setAnalysis(e.target.value as "faturamento" | "margem")} className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white">
              <option className="text-slate-900" value="faturamento">Faturamento</option>
              <option className="text-slate-900" value="margem">Margem / risco</option>
            </select>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Projetos ativos</p>
            <p className="mt-1 text-2xl font-bold">{activeProjects}</p>
            <p className="text-xs text-blue-100/90">{scopedProjects.length} projetos no recorte</p>
          </div>
        </div>
        ) : null}
          </div>
        </div>
      </section>

      <PageHelpModal
        open={showPageHelp}
        onClose={() => setShowPageHelp(false)}
        title="Ajuda da pagina - Painel CEO"
        items={[
          { title: "Resumo", text: "Resumo do que cada bloco mostra e como interpretar os indicadores." },
          { title: "Faturamento recebido", text: "soma de boletins pagos no recorte." },
          { title: "Margem bruta estimada", text: "recebido menos custos estimados (extras + indiretos + folha)." },
          { title: "Receita prevista aberta", text: "saldo ainda a receber de boletins em aberto." },
          { title: "Aditivos pendentes CEO", text: "quantidade e valor aguardando decisao da diretoria/CEO." },
          { title: "Recebimento mensal", text: "evolucao de boletins pagos nos ultimos meses." },
          { title: "Ranking por projeto", text: "ordena por faturamento recebido ou menor margem (risco)." },
          { title: "Top gestores/coordenadores", text: "carteira acompanhada e faturamento associado aos projetos do recorte." },
          { title: "Alertas / Tendencia de margem", text: "blocos de prioridade para decisao e acompanhamento mensal." },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm" open>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Alertas criticos (prioridade)</h2>
              <p className="text-sm text-slate-500">Sinais priorizados para acao executiva imediata.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                {executiveAlerts.length} alerta(s)
              </span>
              <span className="text-xs font-semibold text-slate-500 group-open:rotate-180 transition-transform">▼</span>
            </div>
          </summary>
          <div className="px-5 pb-5">
            <div className="space-y-3">
              {executiveAlerts.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Sem alertas criticos no recorte atual.
                </div>
              ) : (
                executiveAlerts.map((a, idx) => (
                  <div
                    key={`${a.title}-${idx}`}
                    className={cx(
                      "flex items-start gap-3 rounded-xl border p-3",
                      a.level === "alta" && "border-rose-200 bg-rose-50",
                      a.level === "media" && "border-amber-200 bg-amber-50",
                      a.level === "baixa" && "border-blue-200 bg-blue-50"
                    )}
                  >
                    <AlertTriangle
                      size={16}
                      className={cx(
                        "mt-0.5 shrink-0",
                        a.level === "alta" && "text-rose-700",
                        a.level === "media" && "text-amber-700",
                        a.level === "baixa" && "text-blue-700"
                      )}
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                        <span
                          className={cx(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                            a.level === "alta" && "bg-rose-100 text-rose-700",
                            a.level === "media" && "bg-amber-100 text-amber-700",
                            a.level === "baixa" && "bg-blue-100 text-blue-700"
                          )}
                        >
                          {a.level}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{a.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </details>

        <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Tendencia de margem (6 meses)</h2>
                <InfoTooltip title="Tendencia de margem (6 meses)" body={["Mostra a margem estimada por mes com base em recebimentos pagos e custos (extras, indiretos e folha)."]} />
              </div>
              <p className="mt-1 text-sm text-slate-500">Leitura executiva de margem estimada mensal com base em recebimento, custos diretos/indiretos e folha.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="px-5 pb-5">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `ceo-tendencia-margem-6m-${new Date().toISOString().slice(0, 10)}.csv`,
                    ["Mes", "Recebido", "Custo estimado", "Margem", "Margem (%)", "Ano anterior (recebido)"],
                    marginMonthlySeries.map((m) => [
                      m.label,
                      m.current,
                      m.cost,
                      m.margin,
                      Number(m.marginPercent.toFixed(2)),
                      m.previous,
                    ])
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Download size={14} />
                Exportar CSV
              </button>
            </div>
            <div className="space-y-3">
              {marginMonthlySeries.map((m) => (
                <div key={`margin-${m.key}`} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{m.label}</p>
                    <div className="text-right">
                      <p className={cx("text-sm font-semibold", m.marginPercent < 0 ? "text-rose-700" : m.marginPercent < 15 ? "text-amber-700" : "text-emerald-700")}>
                        {pct(m.marginPercent)}
                      </p>
                      <p className="text-xs text-slate-500">{money(m.margin)}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className={cx(
                        "h-2 rounded-full",
                        m.marginPercent < 0 ? "bg-rose-500" : m.marginPercent < 15 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(100, Math.max(4, Math.abs(m.marginPercent)))}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <span>Recebido: {money(m.current)}</span>
                    <span className="text-right">Custo estimado: {money(m.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </section>

      {!isStandaloneTvRoute && msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Faturamento recebido" value={money(receivedNow)} subtitle="Boletins pagos no recorte" tone="pink" helpText="Soma dos valores pagos (boletins com pagamento confirmado) dentro do recorte atual." trend={{ text: `${receivedTrend >= 0 ? "+" : ""}${pct(receivedTrend)} vs janela anterior`, positive: receivedTrend >= 0 }} />
        <StatCard title="Margem bruta estimada" value={money(marginValue)} subtitle={`Margem ${pct(marginPct)} sobre recebido`} tone="amber" helpText="Recebido no recorte menos custos estimados (extras, indiretos e folha projetada)." trend={{ text: marginPct >= 0 ? "Margem positiva" : "Margem negativa", positive: marginPct >= 0 }} />
        <StatCard title="Receita prevista aberta" value={money(forecastOpen)} subtitle="Boletins em aberto (saldo a receber)" tone="blue" helpText="Saldo a receber de boletins ainda nao pagos, considerando valor total menos valor recebido." />
        <StatCard title="Aditivos pendentes CEO" value={String(pendingAditivos.length)} subtitle={`Valor pendente: ${money(pendingAditivosValue)}`} tone="emerald" helpText="Quantidade e valor de aditivos em analise/registrado aguardando decisao do CEO." trend={{ text: overdueBulletins > 0 ? `${overdueBulletins} boletins atrasados` : "Sem boletim atrasado", positive: overdueBulletins === 0 }} />
      </section>

      <section className={cx("grid gap-6", compactMode ? "xl:grid-cols-[1.45fr_1fr]" : "xl:grid-cols-[1.35fr_1fr]")}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Recebimento mensal (6 meses)</h2>
                <InfoTooltip title="Recebimento mensal (6 meses)" body={["Evolucao mensal dos boletins pagos no recorte recente.", "O comparativo com ano anterior fica opcional abaixo."]} />
              </div>
              <p className="mt-1 text-sm text-slate-500">Boletins pagos no recorte recente. Comparativo com ano anterior fica opcional abaixo.</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
              Base atual
            </div>
          </div>

          <div className="mt-5 grid h-[280px] grid-cols-6 items-end gap-3">
            {monthlySeries.map((m) => (
              <div key={m.key} className="flex h-full flex-col justify-end gap-1">
                <div className="relative h-[220px] rounded-lg bg-slate-50 p-2">
                  <div
                    className="absolute bottom-2 left-4 right-4 rounded-md bg-fuchsia-600"
                    style={{ height: `${Math.max(6, (m.current / maxMonthCurrent) * 180)}px` }}
                    title={`Recebido: ${money(m.current)}`}
                  />
                </div>
                <p className="text-center text-xs font-semibold text-slate-600">{m.label}</p>
                <p className="text-center text-[10px] text-slate-500">{money(m.current)}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-fuchsia-600" />Recebido</span>
            {!hasPreviousYearMonthlyBase ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                Sem base de ano anterior (ainda)
              </span>
            ) : null}
          </div>

          <details className="group mt-4 rounded-xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Comparativo com ano anterior</p>
                <p className="text-xs text-slate-500">Abra quando quiser visualizar o confronto mensal (atual vs ano anterior).</p>
              </div>
              <span className="text-xs font-semibold text-slate-500 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="px-4 pb-4">
              {hasPreviousYearMonthlyBase ? (
                <>
                  <div className="grid h-[220px] grid-cols-6 items-end gap-2">
                    {monthlySeries.map((m) => (
                      <div key={`cmp-${m.key}`} className="flex h-full flex-col justify-end gap-1">
                        <div className="relative h-[180px] rounded-lg bg-white p-2">
                          <div
                            className="absolute bottom-2 left-2 right-2 rounded-md border-2 border-dashed border-emerald-400/70 bg-emerald-50"
                            style={{ height: `${Math.max(4, (m.previous / maxMonth) * 145)}px` }}
                            title={`Ano anterior: ${money(m.previous)}`}
                          />
                          <div
                            className="absolute bottom-2 left-4 right-4 rounded-md bg-fuchsia-600"
                            style={{ height: `${Math.max(6, (m.current / maxMonth) * 145)}px` }}
                            title={`Atual: ${money(m.current)}`}
                          />
                        </div>
                        <p className="text-center text-[11px] font-semibold text-slate-600">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-fuchsia-600" />Atual</span>
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-emerald-400" />Ano anterior</span>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  Ainda nao ha base de recebimento no ano anterior para comparar este card.
                </div>
              )}
            </div>
          </details>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {analysis === "faturamento" ? "Ranking por projeto" : "Projetos em risco de margem"}
              </h2>
              <InfoTooltip title="Ranking por projeto" body={["Ordena os projetos pelo faturamento recebido ou pela menor margem estimada, conforme a analise selecionada."]} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {analysis === "faturamento" ? "Top projetos por faturamento recebido." : "Menores margens estimadas aparecem primeiro."}
            </p>
            <div className="mt-4 space-y-3">
              {topProjects.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Sem projetos no recorte.</div>
              ) : (
                topProjects.map((p) => {
                  const metric = analysis === "faturamento" ? p.received : p.margin;
                  const width = Math.min(100, Math.max(6, (Math.abs(metric) / maxTop) * 100));
                  const isRisk = analysis === "margem" && p.margin < 15;
                  return (
                    <div key={p.id}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <span className="truncate font-semibold text-slate-800">{p.name}</span>
                          <div className="text-[11px] text-slate-500">% receb./orcado: {pct(p.receiptRate)}</div>
                        </div>
                        <div className="text-right">
                          <span className={cx("block font-semibold", isRisk ? "text-rose-700" : "text-slate-700")}>
                            {analysis === "faturamento" ? money(p.received) : pct(p.margin)}
                          </span>
                        </div>
                      </div>
                      <div className="h-8 rounded-lg bg-slate-100 p-1">
                        <div
                          className={cx(
                            "flex h-full items-center justify-end rounded-md px-2 text-xs font-semibold text-white",
                            analysis === "faturamento" ? "bg-gradient-to-r from-fuchsia-500 to-pink-600" : isRisk ? "bg-rose-600" : "bg-emerald-600"
                          )}
                          style={{ width: `${width}%` }}
                        >
                          {analysis === "faturamento" ? money(p.received) : pct(p.margin)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {!compactMode ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Top clientes (recebimento)</h2>
                <InfoTooltip title="Top clientes (recebimento)" body={["Clientes com maior recebimento no recorte.", "Mostra saldo aberto e quantidade de projetos."]} />
              </div>
              <p className="mt-1 text-sm text-slate-500">Carteira com maior recebimento no recorte e saldo ainda aberto.</p>
              <div className="mt-4 space-y-3">
                {topClients.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Sem dados de clientes no recorte.</div>
                ) : (
                  topClients.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.projects} projeto(s) | aberto {money(c.openForecast)}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{money(c.received)}</p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-600"
                          style={{ width: `${Math.min(100, Math.max(6, (c.received / maxTopClient) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-800 p-5 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Fila de decisoes do CEO</h2>
                <InfoTooltip title="Fila de decisoes do CEO" body={["Lista aditivos de valor pendentes de aprovacao pela diretoria/CEO.", "Exibe data e valor para priorizacao."]} />
              </div>
              <Link href="/ceo/aditivos-contratuais" className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/15">
                Abrir fila
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {pendingAditivos.length === 0 ? (
                <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/85">Nenhum aditivo pendente de aprovacao.</div>
              ) : (
                pendingAditivos
                  .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
                  .slice(0, 5)
                  .map((a) => {
                    const proj = scopedProjects.find((p) => p.id === a.project_id);
                    return (
                      <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold">{proj?.name ?? "Projeto"}</p>
                          <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-xs font-semibold text-amber-100">{a.status}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/80">
                          <span>{new Date(a.created_at).toLocaleDateString("pt-BR")}</span>
                          <span>{money(Number(a.additional_amount || 0))}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Resumo executivo do recorte</h2>
              <InfoTooltip title="Resumo executivo do recorte" body={["Resumo consolidado de carteira, custos, folha e boletins atrasados conforme filtros aplicados."]} />
            </div>
            <p className="text-sm text-slate-500">Visao rapida para acompanhamento da empresa (receita, custos e caixa previsto).</p>
          </div>
          <div className="text-xs text-slate-500">
            {clientFilter === "all" ? "Todos os clientes" : `Cliente: ${clients.find((c) => c.id === clientFilter)?.name ?? "Selecionado"}`} | {windowKey === "all" ? "Historico" : `Ultimos ${windowKey} dias`}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orcamento da carteira</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{money(scopedProjects.reduce((acc, p) => acc + Number(p.budget_total || 0), 0))}</p>
            <p className="mt-1 text-xs text-slate-500">{scopedProjects.length} projetos</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Custo direto + indireto + folha</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{money(directCost + indirectCost + payroll)}</p>
            <p className="mt-1 text-xs text-slate-500">Custos reconhecidos no recorte</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Folha alocada (projetos)</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{money(payroll)}</p>
            <p className="mt-1 text-xs text-slate-500">Gestores, coordenadores e colaboradores</p>
          </div>
          <div className={cx("rounded-xl border p-4", overdueBulletins > 0 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50")}>
            <p className={cx("text-xs font-semibold uppercase tracking-wide", overdueBulletins > 0 ? "text-rose-700" : "text-emerald-700")}>Boletins atrasados</p>
            <p className={cx("mt-1 text-2xl font-bold", overdueBulletins > 0 ? "text-rose-900" : "text-emerald-900")}>{overdueBulletins}</p>
            <p className={cx("mt-1 text-xs", overdueBulletins > 0 ? "text-rose-800" : "text-emerald-800")}>
              {overdueBulletins > 0 ? "Requer acao de cobranca / acompanhamento" : "Sem alerta de atraso"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linhas da carteira (recorte)</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 font-semibold text-cyan-700">Eolica: {shareLabel(lineDistribution.eolica)}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-700">Solar: {shareLabel(lineDistribution.solar)}</span>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 font-semibold text-violet-700">BESS: {shareLabel(lineDistribution.bess)}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modalidades da carteira (recorte)</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1">Basico: {shareLabel(modalityDistribution.basico)}</div>
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1">Executivo: {shareLabel(modalityDistribution.executivo)}</div>
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1">Eng. proprietario: {shareLabel(modalityDistribution.eng_do_proprietario)}</div>
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1">Consultoria: {shareLabel(modalityDistribution.consultoria)}</div>
            </div>
          </div>
        </div>
      </section>

      {!tvMode && !isStandaloneTvRoute ? (
      <section className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Top gestores/coordenadores</h2>
                <InfoTooltip title="Top gestores/coordenadores" body={["Ranking por carteira acompanhada e faturamento associado aos projetos do recorte atual."]} />
              </div>
              <p className="text-sm text-slate-500">Carteira acompanhada e faturamento associado aos projetos do recorte.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {topGestores.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Sem gestores/coordenadores no recorte.</div>
            ) : (
              topGestores.map((g, idx) => (
                <div key={g.userId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{g.nome}</p>
                    <p className="text-xs text-slate-500">{g.projetos} projeto(s) | margem media {pct(g.margem)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{money(g.faturamento)}</p>
                    <p className="text-xs text-slate-500">recebido</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Leitura executiva (recomendacoes)</h2>
            <InfoTooltip title="Leitura executiva (recomendacoes)" body={["Sintese de alertas e recomendacoes operacionais/financeiras para acao da diretoria."]} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Sintese operacional para acompanhamento da empresa.</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className={cx("rounded-xl border p-3", pendingAditivos.length > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
              <p className="font-semibold">{pendingAditivos.length > 0 ? "Aditivos aguardando decisao do CEO" : "Fila de aditivos sob controle"}</p>
              <p className="mt-1 text-xs opacity-90">
                {pendingAditivos.length > 0
                  ? `${pendingAditivos.length} item(ns) pendente(s), total ${money(pendingAditivosValue)}. Priorizar para evitar travar faturamento/execucao.`
                  : "Nao ha aditivos de valor pendentes no recorte atual."}
              </p>
            </div>
            <div className={cx("rounded-xl border p-3", overdueBulletins > 0 ? "border-rose-200 bg-rose-50 text-rose-900" : "border-slate-200 bg-slate-50 text-slate-900")}>
              <p className="font-semibold">{overdueBulletins > 0 ? "Boletins em atraso detectados" : "Sem boletins atrasados"}</p>
              <p className="mt-1 text-xs opacity-90">
                {overdueBulletins > 0
                  ? `${overdueBulletins} boletim(ns) com status atrasado. Recomendado acompanhamento com Diretoria/Financeiro para cobranca.`
                  : "A fila financeira nao apresenta boletins marcados como atrasados."}
              </p>
            </div>
            <div className={cx("rounded-xl border p-3", marginPct < 15 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-900")}>
              <p className="font-semibold">Margem bruta estimada do recorte: {pct(marginPct)}</p>
              <p className="mt-1 text-xs opacity-90">
                {marginPct < 0
                  ? "Margem negativa no recorte. Revisar custos e velocidade de recebimento."
                  : marginPct < 15
                    ? "Margem comprimida. Avaliar indiretos, extras pendentes e reprogramacao de caixa."
                    : "Margem em faixa saudavel no recorte monitorado."}
              </p>
            </div>
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 17l5-5 4 3 7-8" />
      <path d="M4 20h16" />
    </svg>
  );
}
