"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Trash2, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type Company = { id: string; name: string };
type Project = { id: string; name: string; status: string | null; created_at: string | null };
type RawRole = "admin" | "rh" | "gestor" | "coordenador" | "colaborador" | "financeiro" | "pd" | null;

type CleanupResponse = {
  ok?: boolean;
  error?: string;
  result?: Record<string, unknown>;
};

type CleanupAuditRow = {
  id: string;
  execution_id: string;
  actor_user_id: string | null;
  actor_role: string;
  company_id: string | null;
  operation_key: string;
  status: "success" | "failed";
  operation_payload: Record<string, unknown> | null;
  operation_result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AdminDataCleanupPage() {
  const router = useRouter();
  const { loading: roleLoading, active, role } = useUserRole();

  const [rawRole, setRawRole] = useState<RawRole>(null);
  const [token, setToken] = useState<string>("");

  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [clearDeliverableHistory, setClearDeliverableHistory] = useState(true);
  const [resetSubmissionFields, setResetSubmissionFields] = useState(true);
  const [clearNotifications, setClearNotifications] = useState(false);
  const [clearCompanyProjects, setClearCompanyProjects] = useState(false);
  const [clearSessionAudit, setClearSessionAudit] = useState(true);
  const [sessionAuditRetentionDays, setSessionAuditRetentionDays] = useState(180);

  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [resultText, setResultText] = useState("");
  const [auditRows, setAuditRows] = useState<CleanupAuditRow[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const isSuperAdmin = rawRole === "admin";
  const canAccess = active && role === "admin";

  const companyLabel = useMemo(() => {
    const c = companies.find((x) => x.id === selectedCompanyId);
    return c ? c.name : "";
  }, [companies, selectedCompanyId]);

  async function getSessionToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  const loadRawRoleAndToken = useCallback(async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      router.replace("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .maybeSingle<{ role: RawRole; company_id: string | null }>();

    const tk = await getSessionToken();
    setToken(tk);
    setRawRole(profile?.role ?? null);

    if (profile?.company_id) {
      setSelectedCompanyId(profile.company_id);
    }
  }, [router]);

  async function loadCompanies(currentToken: string) {
    setLoadingCompanies(true);
    try {
      const res = await fetch("/api/admin/company", {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const json = (await res.json()) as { companies?: Company[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar empresas.");

      const list = json.companies ?? [];
      setCompanies(list);

      setSelectedCompanyId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar empresas.");
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  }

  async function loadProjects(currentToken: string, companyId: string) {
    if (!companyId) {
      setProjects([]);
      setSelectedProjectId("");
      return;
    }

    setLoadingProjects(true);
    try {
      const res = await fetch(`/api/admin/data-cleanup?company_id=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const json = (await res.json()) as { projects?: Project[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar projetos.");

      const list = json.projects ?? [];
      setProjects(list);
      setSelectedProjectId("");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar projetos.");
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadAudit(currentToken: string, companyId: string) {
    if (!companyId) {
      setAuditRows([]);
      return;
    }
    setLoadingAudit(true);
    try {
      const res = await fetch(
        `/api/admin/data-cleanup?audit=1&company_id=${encodeURIComponent(companyId)}&limit=50`,
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      const json = (await res.json()) as { audit?: CleanupAuditRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar auditoria.");
      setAuditRows(json.audit ?? []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar auditoria.");
      setAuditRows([]);
    } finally {
      setLoadingAudit(false);
    }
  }

  useEffect(() => {
    if (roleLoading) return;
    if (!canAccess) {
      router.replace("/unauthorized");
      return;
    }

    let mounted = true;

    async function boot() {
      setMsg("");
      const tk = await getSessionToken();
      if (!mounted || !tk) return;

      await loadRawRoleAndToken();
      if (!mounted) return;
      await loadCompanies(tk);
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, [roleLoading, canAccess, router, loadRawRoleAndToken]);

  useEffect(() => {
    if (!token || !selectedCompanyId) return;
    void loadProjects(token, selectedCompanyId);
    void loadAudit(token, selectedCompanyId);
  }, [token, selectedCompanyId]);

  async function runCleanup() {
    setMsg("");
    setResultText("");

    if (!selectedCompanyId) {
      setMsg("Selecione uma empresa.");
      return;
    }

    if (!clearDeliverableHistory && !clearNotifications && !clearCompanyProjects && !clearSessionAudit) {
      setMsg("Selecione ao menos um tipo de limpeza.");
      return;
    }

    if (clearCompanyProjects && !isSuperAdmin) {
      setMsg("Limpeza total de projetos permitida para admin.");
      return;
    }

    const confirmText = [
      "Confirma a limpeza dos dados selecionados?",
      companyLabel ? `Empresa: ${companyLabel}` : "",
      clearDeliverableHistory ? "- Historico de entregaveis" : "",
      clearSessionAudit ? `- Trilha de sessao anterior a ${sessionAuditRetentionDays} dias` : "",
      clearNotifications ? "- Notificacoes" : "",
      clearCompanyProjects ? "- TODOS os projetos da empresa" : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (!window.confirm(confirmText)) return;

    setRunning(true);
    try {
      const res = await fetch("/api/admin/data-cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company_id: selectedCompanyId,
          clear_deliverable_history: clearDeliverableHistory,
          reset_submission_fields: resetSubmissionFields,
          project_id: selectedProjectId || null,
          clear_session_audit: clearSessionAudit,
          session_audit_retention_days: sessionAuditRetentionDays,
          clear_notifications: clearNotifications,
          clear_company_projects: clearCompanyProjects,
        }),
      });

      const json = (await res.json()) as CleanupResponse;
      if (!res.ok) throw new Error(json.error || "Falha na limpeza.");

      setMsg("Limpeza executada com sucesso.");
      setResultText(JSON.stringify(json.result ?? {}, null, 2));

      if (clearCompanyProjects || clearDeliverableHistory) {
        await loadProjects(token, selectedCompanyId);
      }
      await loadAudit(token, selectedCompanyId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao executar limpeza.");
    } finally {
      setRunning(false);
    }
  }

  if (roleLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Validando acesso...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-rose-600 text-white">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Limpeza de dados</h1>
            <p className="mt-1 text-sm text-slate-600">
              Use com cuidado. Esta area apaga historicos e registros de forma permanente.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600">Empresa</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              disabled={loadingCompanies || (!isSuperAdmin && !!selectedCompanyId)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Projeto (opcional)</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loadingProjects || !clearDeliverableHistory}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos os projetos da empresa</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={clearDeliverableHistory}
              onChange={(e) => setClearDeliverableHistory(e.target.checked)}
            />
            Limpar historico de entregaveis
          </label>

          <label className={cx("ml-6 flex items-center gap-2 text-sm", !clearDeliverableHistory && "opacity-50") }>
            <input
              type="checkbox"
              checked={resetSubmissionFields}
              disabled={!clearDeliverableHistory}
              onChange={(e) => setResetSubmissionFields(e.target.checked)}
            />
            Resetar campos de envio/aprovacao do entregavel
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={clearNotifications}
              onChange={(e) => setClearNotifications(e.target.checked)}
            />
            Limpar notificacoes da empresa
          </label>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={clearSessionAudit}
                onChange={(e) => setClearSessionAudit(e.target.checked)}
              />
              Limpar trilha de sessao antiga
            </label>
            <label className={cx("grid gap-1 text-xs font-semibold text-slate-700", !clearSessionAudit && "opacity-50")}>
              Reter ultimos dias
              <input
                type="number"
                min={1}
                max={3650}
                value={sessionAuditRetentionDays}
                disabled={!clearSessionAudit}
                onChange={(e) => setSessionAuditRetentionDays(Number(e.target.value) || 180)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              />
            </label>
          </div>

          <label className={cx("flex items-center gap-2 text-sm", !isSuperAdmin && "opacity-50") }>
            <input
              type="checkbox"
              checked={clearCompanyProjects}
              disabled={!isSuperAdmin}
              onChange={(e) => setClearCompanyProjects(e.target.checked)}
            />
            Limpar TODOS os dados de projetos da empresa (admin)
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={runCleanup}
            disabled={running || !selectedCompanyId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <Trash2 size={16} />
            {running ? "Executando..." : "Executar limpeza"}
          </button>

          <button
            onClick={() => selectedCompanyId && loadProjects(token, selectedCompanyId)}
            disabled={loadingProjects || !selectedCompanyId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} />
            Atualizar projetos
          </button>
          <button
            onClick={() => selectedCompanyId && loadAudit(token, selectedCompanyId)}
            disabled={loadingAudit || !selectedCompanyId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} />
            Atualizar auditoria
          </button>
        </div>

        {msg ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div>
        ) : null}

        {resultText ? (
          <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
            {resultText}
          </pre>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Auditoria de limpeza</h2>
          <span className="text-xs text-slate-500">Ultimos 50 eventos</span>
        </div>
        <div className="space-y-2">
          {loadingAudit ? (
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500">Carregando...</div>
          ) : auditRows.length ? (
            auditRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {row.operation_key} · {row.status === "success" ? "Sucesso" : "Falha"}
                  </p>
                  <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Execucao: {row.execution_id.slice(0, 8)} · Ator: {row.actor_role} · Empresa: {row.company_id ?? "-"}
                </p>
                {row.error_message ? (
                  <p className="mt-1 text-xs text-rose-700">Erro: {row.error_message}</p>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
              Sem eventos de auditoria para a empresa selecionada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
