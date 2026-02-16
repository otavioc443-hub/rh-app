"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "financeiro" | "admin";

type Project = {
  id: string;
  name: string;
  owner_user_id: string;
  company_id?: string | null;
  client_id?: string | null;
  project_type?: ProjectType | null;
  project_scopes?: string[] | null;
  start_date: string | null;
  end_date: string | null;
  budget_total?: number | null;
  created_at: string;
};
type ProjectType =
  | "hv"
  | "rmt"
  | "basico"
  | "estrutural"
  | "civil"
  | "eletromecanico"
  | "eletrico"
  | "hidraulico"
  | "outro";
type ProjectClient = { id: string; name: string; active: boolean };
type ProjectMember = { id: string; project_id: string; user_id: string; member_role: "gestor" | "coordenador" | "colaborador" };
type Deliverable = { id: string; project_id: string; status: "pending" | "in_progress" | "sent" | "approved" };
type Colaborador = { user_id: string | null; email: string | null; nome: string | null; cargo: string | null; salario: number | null };

type ExtraPayment = {
  id: string;
  project_id: string;
  user_id: string;
  amount: number;
  reference_month: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  requested_by: string;
  finance_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

type Attachment = {
  id: string;
  payment_id: string;
  file_url: string;
  file_name: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  payment_id: string | null;
  action: "insert" | "update" | "delete";
  created_at: string;
  created_by: string | null;
  old_row: unknown;
  new_row: unknown;
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function projectTypeLabel(value: ProjectType | null | undefined) {
  if (value === "hv") return "HV";
  if (value === "rmt") return "RMT";
  if (value === "basico") return "Basico";
  if (value === "estrutural") return "Estrutural";
  if (value === "civil") return "Civil";
  if (value === "eletromecanico") return "Eletromecanico";
  if (value === "eletrico") return "Eletrico";
  if (value === "hidraulico") return "Hidraulico";
  if (value === "outro") return "Outro";
  return "-";
}

function safeNum(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  const needs = /[",\n\r]/.test(s);
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
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

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(n: number) {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = monthKey(d);
    out.push({ key: k, label: k });
  }
  return out;
}

function parseISODateOnly(v: string | null) {
  if (!v) return null;
  // v vem como YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
}

function monthStart(ym: string) {
  const [y, m] = ym.split("-").map((x) => Number(x));
  return new Date(y, (m || 1) - 1, 1);
}

function inProjectMonth(ym: string, start: Date | null, end: Date | null) {
  const ms = monthStart(ym);
  const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
  if (start && me < start) return false;
  if (end && ms > end) return false;
  return true;
}

function monthsBetweenInclusive(start: Date, end: Date) {
  const a = start.getFullYear() * 12 + start.getMonth();
  const b = end.getFullYear() * 12 + end.getMonth();
  return Math.max(1, b - a + 1);
}

type ProjectSummary = {
  project_id: string;
  payroll_monthly: number;
  progress_pct: number;
  extras_pending: number;
  extras_approved: number;
  extras_paid: number;
  extras_total: number;
  projected_total: number;
  realized_total: number;
};

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [isAllowed, setIsAllowed] = useState(false);
  const [meId, setMeId] = useState("");
  const [needsCompanyLink, setNeedsCompanyLink] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectClients, setProjectClients] = useState<ProjectClient[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [colabsByUserId, setColabsByUserId] = useState<Record<string, Colaborador>>({});

  const [requests, setRequests] = useState<ExtraPayment[]>([]);
  const [noteByReqId, setNoteByReqId] = useState<Record<string, string>>({});
  const [attachmentsByPaymentId, setAttachmentsByPaymentId] = useState<Record<string, Attachment[]>>({});
  const [auditByPaymentId, setAuditByPaymentId] = useState<Record<string, AuditRow[]>>({});

  const [summariesByProjectId, setSummariesByProjectId] = useState<Record<string, ProjectSummary>>({});
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [companyChartPoints, setCompanyChartPoints] = useState<Array<{ key: string; label: string; payroll: number; extras: number; total: number }>>([]);

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of projectClients) map[c.id] = c.name;
    return map;
  }, [projectClients]);

  const projectMembers = useMemo(() => members.filter((m) => m.project_id === selectedProjectId), [members, selectedProjectId]);
  const projectDeliverables = useMemo(() => deliverables.filter((d) => d.project_id === selectedProjectId), [deliverables, selectedProjectId]);
  const projectRequests = useMemo(() => requests.filter((r) => r.project_id === selectedProjectId), [requests, selectedProjectId]);

  const progressPct = useMemo(() => {
    const total = projectDeliverables.length;
    if (!total) return 0;
    const approved = projectDeliverables.filter((d) => d.status === "approved").length;
    return Math.round((approved / total) * 100);
  }, [projectDeliverables]);

  const personLabel = (userId: string) => {
    const c = colabsByUserId[userId];
    return c?.nome?.trim() || `Colaborador ${userId.slice(0, 8)}`;
  };

  const salaryRows = useMemo(() => {
    return projectMembers.map((m) => {
      const c = colabsByUserId[m.user_id];
      const salario = Number(c?.salario ?? 0) || 0;
      return {
        user_id: m.user_id,
        member_role: m.member_role,
        name: c?.nome?.trim() || `Colaborador ${m.user_id.slice(0, 8)}`,
        email: c?.email ?? "-",
        cargo: c?.cargo ?? "-",
        salario,
      };
    });
  }, [projectMembers, colabsByUserId]);

  const monthlyPayroll = useMemo(() => salaryRows.reduce((acc, r) => acc + (Number(r.salario) || 0), 0), [salaryRows]);

  const payrollByRole = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of salaryRows) {
      const k = String(r.member_role);
      out[k] = (out[k] ?? 0) + (Number(r.salario) || 0);
    }
    return out;
  }, [salaryRows]);

  const projectDates = useMemo(() => {
    const s = parseISODateOnly(selectedProject?.start_date ?? null);
    const e = parseISODateOnly(selectedProject?.end_date ?? null);
    return { start: s, end: e };
  }, [selectedProject?.start_date, selectedProject?.end_date]);

  const projectDurationMonths = useMemo(() => {
    if (!projectDates.start || !projectDates.end) return null;
    return monthsBetweenInclusive(projectDates.start, projectDates.end);
  }, [projectDates.start, projectDates.end]);

  const projectElapsedMonths = useMemo(() => {
    if (!projectDates.start) return null;
    const now = new Date();
    const effectiveEnd = projectDates.end && projectDates.end < now ? projectDates.end : now;
    return monthsBetweenInclusive(projectDates.start, effectiveEnd);
  }, [projectDates.start, projectDates.end]);

  const extrasTotals = useMemo(() => {
    const all = projectRequests;
    const pending = all.filter((r) => r.status === "pending").reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const approved = all.filter((r) => r.status === "approved").reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const paid = all.filter((r) => r.status === "paid").reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return { pending, approved, paid };
  }, [projectRequests]);

  const chart = useMemo(() => {
    const months = lastMonths(6);
    const extrasByMonth: Record<string, number> = {};
    for (const r of projectRequests) {
      const k = String(r.reference_month).slice(0, 7);
      extrasByMonth[k] = (extrasByMonth[k] ?? 0) + (Number(r.amount) || 0);
    }
    const points = months.map((m) => {
      const extras = extrasByMonth[m.key] ?? 0;
      const payroll = inProjectMonth(m.key, projectDates.start, projectDates.end) ? monthlyPayroll : 0;
      return { ...m, payroll, extras, total: payroll + extras };
    });
    const max = Math.max(1, ...points.map((p) => p.total));
    return { points, max };
  }, [projectRequests, monthlyPayroll, projectDates.start, projectDates.end]);

  const companyChart = useMemo(() => {
    const points = companyChartPoints;
    const max = Math.max(1, ...points.map((p) => p.total));
    return { points, max };
  }, [companyChartPoints]);

  const projectedTotalCost = useMemo(() => {
    // Se tiver datas, projeta folha pelo numero de meses do projeto. Caso contrario, mostra apenas folha mensal.
    const months = projectDurationMonths ?? 1;
    const payrollProjected = monthlyPayroll * months;
    const extrasProjected = projectRequests.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return payrollProjected + extrasProjected;
  }, [monthlyPayroll, projectRequests, projectDurationMonths]);

  const realizedCost = useMemo(() => {
    // Aproximação: folha mensal * meses decorridos + extras aprovados/pagos.
    const months = projectElapsedMonths ?? 1;
    const payrollRealized = monthlyPayroll * months;
    const extrasRealized = projectRequests
      .filter((r) => r.status === "approved" || r.status === "paid")
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return payrollRealized + extrasRealized;
  }, [monthlyPayroll, projectRequests, projectElapsedMonths]);

  function exportSelectedProjectCsv() {
    if (!selectedProject) return;

    const projectNameSafe = (selectedProject.name || "projeto").replace(/[^\w\-]+/g, "_").slice(0, 64);
    const filename = `financeiro_${projectNameSafe}_${new Date().toISOString().slice(0, 10)}.csv`;

    const lines: string[] = [];
    lines.push(["secao", "campo", "valor"].map(csvEscape).join(","));
    lines.push(["projeto", "nome", selectedProject.name].map(csvEscape).join(","));
    lines.push(["projeto", "cliente", selectedProject.client_id ? (clientNameById[selectedProject.client_id] ?? selectedProject.client_id) : ""].map(csvEscape).join(","));
    lines.push(["projeto", "tipo", projectTypeLabel(selectedProject.project_type)].map(csvEscape).join(","));
    lines.push(["projeto", "escopos", (selectedProject.project_scopes ?? []).map((s) => projectTypeLabel(s as ProjectType)).join(" | ")].map(csvEscape).join(","));
    lines.push(["projeto", "inicio", selectedProject.start_date ?? ""].map(csvEscape).join(","));
    lines.push(["projeto", "fim", selectedProject.end_date ?? ""].map(csvEscape).join(","));
    lines.push(["projeto", "orcamento_total", selectedProject.budget_total ?? ""].map(csvEscape).join(","));
    lines.push(["kpi", "entrega_pct", progressPct].map(csvEscape).join(","));
    lines.push(["kpi", "folha_mensal_estimada", monthlyPayroll].map(csvEscape).join(","));
    lines.push(["kpi", "custo_planejado_estimado", projectedTotalCost].map(csvEscape).join(","));
    lines.push(["kpi", "custo_realizado_estimado", realizedCost].map(csvEscape).join(","));
    lines.push(["extras", "pendente", extrasTotals.pending].map(csvEscape).join(","));
    lines.push(["extras", "aprovado", extrasTotals.approved].map(csvEscape).join(","));
    lines.push(["extras", "pago", extrasTotals.paid].map(csvEscape).join(","));

    lines.push("");
    lines.push(["membros", "user_id", "nome", "email", "cargo", "papel", "salario"].map(csvEscape).join(","));
    for (const r of salaryRows) {
      lines.push(["membro", r.user_id, r.name, r.email, r.cargo, r.member_role, r.salario].map(csvEscape).join(","));
    }

    lines.push("");
    lines.push(["extras", "id", "user_id", "mes", "valor", "status", "descricao"].map(csvEscape).join(","));
    for (const r of projectRequests) {
      lines.push([
        "extra",
        r.id,
        r.user_id,
        String(r.reference_month).slice(0, 7),
        Number(r.amount) || 0,
        r.status,
        r.description ?? "",
      ].map(csvEscape).join(","));
    }

    lines.push("");
    lines.push(["entregaveis", "id", "status"].map(csvEscape).join(","));
    for (const d of projectDeliverables) {
      lines.push(["deliverable", d.id, d.status].map(csvEscape).join(","));
    }

    downloadTextFile(filename, lines.join("\n"), "text/csv;charset=utf-8");
  }

  const loadSummaries = useCallback(async (projectList: Project[]) => {
    const ids = projectList.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) {
      setSummariesByProjectId({});
      return;
    }

    setSummariesLoading(true);
    try {
      const [memRes, delRes, reqRes] = await Promise.all([
        supabase.from("project_members").select("id,project_id,user_id,member_role").in("project_id", ids),
        supabase.from("project_deliverables").select("id,project_id,status").in("project_id", ids),
        supabase
          .from("project_extra_payments")
          .select("id,project_id,user_id,amount,reference_month,status")
          .in("project_id", ids),
      ]);
      if (memRes.error) throw new Error(memRes.error.message);
      if (delRes.error) throw new Error(delRes.error.message);
      if (reqRes.error) throw new Error(reqRes.error.message);

      const allMembers = (memRes.data ?? []) as ProjectMember[];
      const allDeliverables = (delRes.data ?? []) as Deliverable[];
      const allReq = (reqRes.data ?? []) as Array<Pick<ExtraPayment, "project_id" | "amount" | "status" | "reference_month">>;

      const userIds = Array.from(new Set(allMembers.map((m) => m.user_id))).filter(Boolean);
      const colMap: Record<string, Colaborador> = {};
      if (userIds.length) {
        const colRes = await supabase.from("colaboradores").select("user_id,email,nome,cargo,salario").in("user_id", userIds);
        if (colRes.error) throw new Error(colRes.error.message);
        for (const c of (colRes.data ?? []) as Colaborador[]) {
          const uid = String(c.user_id ?? "").trim();
          if (uid) colMap[uid] = c;
        }
      }

      const membersByPid: Record<string, ProjectMember[]> = {};
      for (const m of allMembers) {
        (membersByPid[m.project_id] ??= []).push(m);
      }

      const deliverablesByPid: Record<string, Deliverable[]> = {};
      for (const d of allDeliverables) {
        (deliverablesByPid[d.project_id] ??= []).push(d);
      }

      const reqByPid: Record<string, typeof allReq> = {};
      for (const r of allReq) {
        (reqByPid[r.project_id] ??= []).push(r);
      }

      const now = new Date();
      const out: Record<string, ProjectSummary> = {};

      // Empresa: consolidado por mes (ultimos 12 meses)
      const months = lastMonths(12);
      const extrasByMonth: Record<string, number> = {};
      for (const r of allReq) {
        const k = String(r.reference_month).slice(0, 7);
        extrasByMonth[k] = (extrasByMonth[k] ?? 0) + safeNum(r.amount);
      }
      const companyPayrollByMonth: Record<string, number> = {};

      for (const p of projectList) {
        const pm = membersByPid[p.id] ?? [];
        const pd = deliverablesByPid[p.id] ?? [];
        const pr = reqByPid[p.id] ?? [];

        const payrollMonthly = pm.reduce((acc, m) => acc + safeNum(colMap[m.user_id]?.salario ?? 0), 0);

        const totalDocs = pd.length || 0;
        const approved = pd.filter((d) => d.status === "approved").length;
        const progress = totalDocs ? Math.round((approved / totalDocs) * 100) : 0;

        const extrasPending = pr.filter((r) => r.status === "pending").reduce((acc, r) => acc + safeNum(r.amount), 0);
        const extrasApproved = pr.filter((r) => r.status === "approved").reduce((acc, r) => acc + safeNum(r.amount), 0);
        const extrasPaid = pr.filter((r) => r.status === "paid").reduce((acc, r) => acc + safeNum(r.amount), 0);
        const extrasTotal = pr.reduce((acc, r) => acc + safeNum(r.amount), 0);

        const start = parseISODateOnly(p.start_date ?? null);
        const end = parseISODateOnly(p.end_date ?? null);
        const durationMonths = start && end ? monthsBetweenInclusive(start, end) : 1;
        const elapsedMonths = start ? monthsBetweenInclusive(start, end && end < now ? end : now) : 1;

        const projected = payrollMonthly * durationMonths + extrasTotal;
        const realized = payrollMonthly * elapsedMonths + (extrasApproved + extrasPaid);

        out[p.id] = {
          project_id: p.id,
          payroll_monthly: payrollMonthly,
          progress_pct: progress,
          extras_pending: extrasPending,
          extras_approved: extrasApproved,
          extras_paid: extrasPaid,
          extras_total: extrasTotal,
          projected_total: projected,
          realized_total: realized,
        };

        for (const m of months) {
          if (!inProjectMonth(m.key, start, end)) continue;
          companyPayrollByMonth[m.key] = (companyPayrollByMonth[m.key] ?? 0) + payrollMonthly;
        }
      }

      setSummariesByProjectId(out);

      const companyPoints = months.map((m) => {
        const payroll = companyPayrollByMonth[m.key] ?? 0;
        const extras = extrasByMonth[m.key] ?? 0;
        return { ...m, payroll, extras, total: payroll + extras };
      });
      setCompanyChartPoints(companyPoints);
    } catch (e: unknown) {
      setSummariesByProjectId({});
      setCompanyChartPoints([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar resumo de projetos.");
    } finally {
      setSummariesLoading(false);
    }
  }, []);

  const boot = useCallback(async () => {
    setLoading(true);
    setMsg("");
    setNeedsCompanyLink(false);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Não autenticado.");
      const userId = authData.user.id;
      setMeId(userId);

      let effectiveRole: Role | null = null;
      try {
        const { data: cr, error: crErr } = await supabase.rpc("current_role");
        if (!crErr) effectiveRole = (cr as Role) ?? null;
      } catch {
        // ignore
      }

      const allowed = effectiveRole === "admin" || effectiveRole === "financeiro";
      setIsAllowed(allowed);
      if (!allowed) {
        setProjects([]);
        setSelectedProjectId("");
        return;
      }

      // Para a role financeiro funcionar, é obrigatório profiles.company_id estar preenchido.
      // Usamos a função do banco (security definer) para não depender de SELECT em profiles.
      let companyId: string | null = null;
      if (effectiveRole === "financeiro") {
        const cc = await supabase.rpc("current_company_id");
        if (!cc.error && cc.data) companyId = String(cc.data);
        if (!companyId) {
          setNeedsCompanyLink(true);
          setProjects([]);
          setSelectedProjectId("");
          return;
        }
      } else {
      }

      const q = supabase
        .from("projects")
        .select("id,name,owner_user_id,company_id,client_id,project_type,project_scopes,start_date,end_date,budget_total,created_at")
        .order("created_at", { ascending: false });

      const projRes = companyId ? await q.eq("company_id", companyId) : await q;
      if (projRes.error) throw new Error(projRes.error.message);
      const list = (projRes.data ?? []) as Project[];
      setProjects(list);
      const clientRes = await supabase.from("project_clients").select("id,name,active").eq("active", true).order("name", { ascending: true });
      if (!clientRes.error) setProjectClients((clientRes.data ?? []) as ProjectClient[]);
      setSelectedProjectId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]?.id ?? ""));
      void loadSummaries(list);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [loadSummaries]);

  async function loadProjectData(projectId: string) {
    if (!projectId) return;
    setMsg("");
    try {
      const [memRes, delRes, reqRes] = await Promise.all([
        supabase.from("project_members").select("id,project_id,user_id,member_role").eq("project_id", projectId),
        supabase.from("project_deliverables").select("id,project_id,status").eq("project_id", projectId),
        supabase
          .from("project_extra_payments")
          .select("id,project_id,user_id,amount,reference_month,description,status,requested_by,finance_note,decided_by,decided_at,created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
      ]);
      if (memRes.error) throw new Error(memRes.error.message);
      if (delRes.error) throw new Error(delRes.error.message);
      if (reqRes.error) throw new Error(reqRes.error.message);

      const mem = (memRes.data ?? []) as ProjectMember[];
      const del = (delRes.data ?? []) as Deliverable[];
      const req = (reqRes.data ?? []) as ExtraPayment[];
      setMembers(mem);
      setDeliverables(del);
      setRequests((prev) => {
        const others = prev.filter((x) => x.project_id !== projectId);
        return [...others, ...req];
      });
      setNoteByReqId((prev) => {
        const next = { ...prev };
        for (const r of req) if (typeof next[r.id] !== "string") next[r.id] = r.finance_note ?? "";
        return next;
      });

      const userIds = Array.from(new Set(mem.map((m) => m.user_id)));
      if (userIds.length) {
        const colRes = await supabase.from("colaboradores").select("user_id,email,nome,cargo,salario").in("user_id", userIds);
        if (colRes.error) throw new Error(colRes.error.message);
        const cmap: Record<string, Colaborador> = {};
        for (const c of (colRes.data ?? []) as Colaborador[]) {
          const uid = String(c.user_id ?? "").trim();
          if (uid) cmap[uid] = c;
        }
        setColabsByUserId(cmap);
      } else {
        setColabsByUserId({});
      }

      // Anexos + auditoria (nao bloquear se tabelas ainda nao existirem)
      try {
        const ids = req.map((x) => x.id);
        if (!ids.length) {
          setAttachmentsByPaymentId({});
          setAuditByPaymentId({});
        } else {
          const [aRes, auRes] = await Promise.all([
            supabase
              .from("project_extra_payment_attachments")
              .select("id,payment_id,file_url,file_name,created_at")
              .in("payment_id", ids)
              .order("created_at", { ascending: false }),
            supabase
              .from("project_extra_payments_audit")
              .select("id,payment_id,action,created_at,created_by,old_row,new_row")
              .in("payment_id", ids)
              .order("created_at", { ascending: false }),
          ]);

          if (!aRes.error) {
            const map: Record<string, Attachment[]> = {};
            for (const row of (aRes.data ?? []) as Attachment[]) (map[row.payment_id] ??= []).push(row);
            setAttachmentsByPaymentId(map);
          } else {
            setAttachmentsByPaymentId({});
          }

          if (!auRes.error) {
            const map: Record<string, AuditRow[]> = {};
            for (const row of (auRes.data ?? []) as AuditRow[]) {
              const pid = row.payment_id;
              if (!pid) continue;
              (map[pid] ??= []).push(row);
            }
            setAuditByPaymentId(map);
          } else {
            setAuditByPaymentId({});
          }
        }
      } catch {
        setAttachmentsByPaymentId({});
        setAuditByPaymentId({});
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar dados do projeto.");
    }
  }

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (!isAllowed) return;
    void loadProjectData(selectedProjectId);
  }, [selectedProjectId, isAllowed]);

  async function decide(req: ExtraPayment, status: ExtraPayment["status"]) {
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        status,
        finance_note: (noteByReqId[req.id] ?? "").trim() || null,
        decided_by: meId,
        decided_at: new Date().toISOString(),
      };
      const r = await supabase.from("project_extra_payments").update(payload).eq("id", req.id);
      if (r.error) throw r.error;
      await loadProjectData(selectedProjectId);
      setMsg("Atualizado.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-6 w-[260px] animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-3 h-4 w-[420px] animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-6 h-56 w-full animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Acesso restrito ao Financeiro/Admin.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Financeiro</h1>
          <p className="mt-1 text-sm text-slate-600">Solicitações de valores extras, custo do projeto e relatórios de folha.</p>
        </div>
        <button
          type="button"
          onClick={() => void boot()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <RefreshCcw size={16} /> Atualizar
        </button>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">{msg}</div> : null}

      {needsCompanyLink ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Este usuário está com role <b>financeiro</b>, mas ainda não possui uma empresa vinculada no perfil (
          <code>profiles.company_id</code>). Sem isso, o Financeiro não consegue listar projetos.
          <div className="mt-2 text-xs text-amber-900/80">
            Ação: um Admin deve preencher <code>profiles.company_id</code> para este usuário (empresa da Sólida, por
            exemplo). Depois recarregue esta página.
          </div>
        </div>
      ) : null}

      <details className="rounded-3xl border border-slate-200 bg-white p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">Empresa: custos por mês (consolidado)</div>
            <div className="text-sm text-slate-600">Folha + extras somados em todos os projetos.</div>
          </div>
          <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            Mostrar
          </span>
        </summary>

        <div className="mt-4">
          {companyChart.points.length ? (
            <>
              <div className="grid grid-cols-6 gap-3">
                {companyChart.points.slice(-6).map((p) => {
                  const hTotal = Math.round((p.total / companyChart.max) * 120);
                  const hPayroll = Math.round((p.payroll / companyChart.max) * 120);
                  const hExtras = Math.max(0, hTotal - hPayroll);
                  return (
                    <div key={p.key} className="flex flex-col items-center gap-2">
                      <div className="relative w-full max-w-[70px] rounded-xl bg-slate-100" style={{ height: 130 }}>
                        <div className="absolute bottom-0 left-0 right-0 rounded-xl bg-slate-900/80" style={{ height: hPayroll }} />
                        <div className="absolute bottom-0 left-0 right-0 rounded-xl bg-emerald-500/80" style={{ height: hExtras }} />
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700">{p.label}</div>
                      <div className="text-[11px] text-slate-500">{fmtMoney(p.total)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-900/80" /> Folha
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> Extras
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Sem dados suficientes para o consolidado (ou carregando).
            </div>
          )}
        </div>
      </details>

      <details className="rounded-3xl border border-slate-200 bg-white p-5" open={false}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">Resumo por projetos</div>
            <div className="text-sm text-slate-600">
              {summariesLoading ? "Carregando..." : `Projetos: ${projects.length}`}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void loadSummaries(projects);
            }}
            disabled={summariesLoading || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            title="Recarregar resumo"
          >
            <RefreshCcw size={14} className={summariesLoading ? "animate-spin" : ""} /> Atualizar resumo
          </button>
        </summary>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Projeto</th>
                <th className="p-3 text-right">Orçamento</th>
                <th className="p-3 text-right">Realizado (est.)</th>
                <th className="p-3 text-right">Folha mensal</th>
                <th className="p-3 text-right">Extras pend.</th>
                <th className="p-3 text-right">% entrega</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {projects.length ? (
                projects.map((p) => {
                  const s = summariesByProjectId[p.id] ?? null;
                  const planned =
                    typeof p.budget_total === "number" && Number.isFinite(p.budget_total)
                      ? Number(p.budget_total) || 0
                      : s?.projected_total ?? 0;

                  const active = p.id === selectedProjectId;
                  return (
                    <tr key={p.id} className={`border-t ${active ? "bg-emerald-50/40" : ""}`}>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.start_date || "-"} até {p.end_date || "-"}</div>
                        <div className="text-xs text-slate-500">
                          Cliente: {p.client_id ? (clientNameById[p.client_id] ?? p.client_id) : "-"} | Tipo: {projectTypeLabel(p.project_type)}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-900">{fmtMoney(planned)}</td>
                      <td className="p-3 text-right text-slate-900">{fmtMoney(s?.realized_total ?? 0)}</td>
                      <td className="p-3 text-right text-slate-700">{fmtMoney(s?.payroll_monthly ?? 0)}</td>
                      <td className="p-3 text-right text-slate-700">{fmtMoney(s?.extras_pending ?? 0)}</td>
                      <td className="p-3 text-right">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {s?.progress_pct ?? 0}%
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedProjectId(p.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Selecionar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={7}>
                    Nenhum projeto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Projeto
            <select
              className="h-11 w-full min-w-[320px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => exportSelectedProjectCsv()}
            disabled={!selectedProjectId}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            title="Baixar CSV do projeto selecionado"
          >
            Exportar CSV
          </button>
        </div>
        {selectedProject ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Cliente: {selectedProject.client_id ? (clientNameById[selectedProject.client_id] ?? selectedProject.client_id) : "-"} | Tipo: {projectTypeLabel(selectedProject.project_type)}
            {selectedProject.project_scopes?.length
              ? ` | Escopos: ${selectedProject.project_scopes.map((s) => projectTypeLabel(s as ProjectType)).join(", ")}`
              : ""}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Custo planejado (projeto)</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {typeof selectedProject?.budget_total === "number" && Number.isFinite(selectedProject.budget_total)
                ? fmtMoney(Number(selectedProject.budget_total) || 0)
                : fmtMoney(projectedTotalCost)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedProject?.budget_total ? "Orçamento do projeto" : "Folha projetada + extras"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">% entrega</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{progressPct}%</p>
            <p className="mt-1 text-xs text-slate-500">Aprovados / entregáveis</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Custo realizado (estimado)</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{fmtMoney(realizedCost)}</p>
            <p className="mt-1 text-xs text-slate-500">Folha (meses) + extras aprovados/pagos</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Folha mensal (estimada)</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{fmtMoney(monthlyPayroll)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {projectDurationMonths ? `Duração: ${projectDurationMonths} meses` : "Defina datas para estimar duração"}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-600">Extras pendentes</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(extrasTotals.pending)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-600">Extras aprovados</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(extrasTotals.approved)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-600">Extras pagos</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(extrasTotals.paid)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Custos por mês (folha + extras)</h2>
        <p className="mt-1 text-sm text-slate-600">Últimos 6 meses.</p>

        <div className="mt-4 grid grid-cols-6 gap-3">
          {chart.points.map((p) => {
            const hTotal = Math.round((p.total / chart.max) * 120);
            const hPayroll = Math.round((p.payroll / chart.max) * 120);
            const hExtras = Math.max(0, hTotal - hPayroll);
            return (
              <div key={p.key} className="flex flex-col items-center gap-2">
                <div className="relative w-full max-w-[70px] rounded-xl bg-slate-100" style={{ height: 130 }}>
                  <div className="absolute bottom-0 left-0 right-0 rounded-xl bg-slate-900/80" style={{ height: hPayroll }} />
                  <div className="absolute bottom-0 left-0 right-0 rounded-xl bg-emerald-500/80" style={{ height: hExtras }} />
                </div>
                <div className="text-[11px] font-semibold text-slate-700">{p.label}</div>
                <div className="text-[11px] text-slate-500">{fmtMoney(p.total)}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
          <div className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-900/80" /> Folha
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> Extras
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Verificação de custos de folha (por colaborador)</h2>
        <p className="mt-1 text-sm text-slate-600">Baseado em `colaboradores.salario` (join por `colaboradores.user_id`).</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Folha (gestor)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(payrollByRole.gestor ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Folha (coordenador)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(payrollByRole.coordenador ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Folha (colaborador)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(payrollByRole.colaborador ?? 0)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">E-mail</th>
                <th className="p-3">Cargo</th>
                <th className="p-3">Papel no projeto</th>
                <th className="p-3 text-right">Salário</th>
              </tr>
            </thead>
            <tbody>
              {salaryRows.length ? (
                salaryRows.map((r) => (
                  <tr key={r.user_id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{r.name}</div>
                    </td>
                    <td className="p-3 text-slate-600">{r.email}</td>
                    <td className="p-3 text-slate-600">{r.cargo}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{r.member_role}</span>
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-900">{fmtMoney(r.salario)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={5}>
                    Sem dados de folha para este projeto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Solicitações de pagamentos extras</h2>
        <p className="mt-1 text-sm text-slate-600">Aprovar, rejeitar ou marcar como pago.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Mês</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Obs. Financeiro</th>
                <th className="p-3">Anexos</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {projectRequests.length ? (
                projectRequests.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{personLabel(r.user_id)}</div>
                    </td>
                    <td className="p-3">{String(r.reference_month).slice(0, 7)}</td>
                    <td className="p-3">{fmtMoney(Number(r.amount) || 0)}</td>
                    <td className="p-3 text-slate-600">{r.description ?? "-"}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{r.status}</span>
                    </td>
                    <td className="p-3">
                      <input
                        className="h-10 w-full min-w-[260px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        value={noteByReqId[r.id] ?? ""}
                        onChange={(e) => setNoteByReqId((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Observação do financeiro..."
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {(attachmentsByPaymentId[r.id] ?? []).slice(0, 2).map((a) => (
                            <a
                              key={a.id}
                              href={a.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                              title={a.file_name ?? "Anexo"}
                            >
                              Ver
                            </a>
                          ))}
                          {(attachmentsByPaymentId[r.id] ?? []).length > 2 ? (
                            <span className="text-xs text-slate-500">+{(attachmentsByPaymentId[r.id] ?? []).length - 2}</span>
                          ) : null}
                        </div>

                        {(auditByPaymentId[r.id] ?? []).length ? (
                          <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <summary className="cursor-pointer text-xs font-semibold text-slate-700">Auditoria</summary>
                            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                              {(auditByPaymentId[r.id] ?? []).slice(0, 4).map((a) => (
                                <div key={a.id} className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-700">{a.action}</span>
                                  <span>{new Date(a.created_at).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void decide(r, "approved")}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          <Save size={14} /> Aprovar
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void decide(r, "rejected")}
                          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          <Save size={14} /> Rejeitar
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void decide(r, "paid")}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          <Save size={14} /> Pago
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={8}>
                    Nenhuma solicitação para este projeto.
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


