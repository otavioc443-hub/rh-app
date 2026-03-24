"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { EthicsCaseDetailsDrawer } from "@/components/admin/ethics/EthicsCaseDetailsDrawer";
import { EthicsCasesTable } from "@/components/admin/ethics/EthicsCasesTable";
import { EthicsFilters } from "@/components/admin/ethics/EthicsFilters";
import { EthicsSummaryCards } from "@/components/admin/ethics/EthicsSummaryCards";
import type {
  EthicsCaseFiltersState,
  EthicsCaseRecord,
  EthicsCasesSortKey,
  EthicsCasesSortState,
  EthicsDashboardData,
  EthicsSummary,
} from "@/lib/ethicsCases/types";

const PAGE_SIZE = 10;

const DEFAULT_FILTERS: EthicsCaseFiltersState = {
  search: "",
  status: "all",
  category: "all",
  risk: "all",
  origin: "all",
  openedFrom: "",
  openedTo: "",
};

function formatDateKey(value: string) {
  return new Date(value).getTime();
}

function buildSummary(cases: EthicsCaseRecord[]): EthicsSummary {
  const byStatus = {
    Recebido: 0,
    "Em triagem": 0,
    "Em análise": 0,
    "Em investigação": 0,
    Concluído: 0,
    Encerrado: 0,
    Reaberto: 0,
  } as EthicsSummary["byStatus"];
  for (const item of cases) byStatus[item.status] += 1;
  return { total: cases.length, byStatus };
}

function sortCases(items: EthicsCaseRecord[], sort: EthicsCasesSortState) {
  return [...items].sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    const getOrigin = (item: EthicsCaseRecord) => (item.is_anonymous ? "anonymous" : "identified");

    const valueA =
      sort.key === "created_at" || sort.key === "last_update_at"
        ? formatDateKey(a[sort.key])
        : sort.key === "origin"
          ? getOrigin(a)
          : sort.key === "assigned_to_name"
            ? a.assigned_to_name ?? ""
            : a[sort.key];
    const valueB =
      sort.key === "created_at" || sort.key === "last_update_at"
        ? formatDateKey(b[sort.key])
        : sort.key === "origin"
          ? getOrigin(b)
          : sort.key === "assigned_to_name"
            ? b.assigned_to_name ?? ""
            : b[sort.key];

    if (valueA < valueB) return -1 * direction;
    if (valueA > valueB) return 1 * direction;
    return 0;
  });
}

export function EthicsCasesAdminClient({
  initialData,
  canManage,
}: {
  initialData: EthicsDashboardData;
  canManage: boolean;
}) {
  const [cases, setCases] = useState(initialData.cases);
  const [filters, setFilters] = useState<EthicsCaseFiltersState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<EthicsCasesSortState>({ key: "created_at", direction: "desc" });
  const [page, setPage] = useState(1);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(initialData.warning);

  const categories = useMemo(() => Array.from(new Set(cases.map((item) => item.category))).sort((a, b) => a.localeCompare(b)), [cases]);

  const filteredCases = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const start = filters.openedFrom ? new Date(`${filters.openedFrom}T00:00:00`).getTime() : null;
    const end = filters.openedTo ? new Date(`${filters.openedTo}T23:59:59`).getTime() : null;

    return cases.filter((item) => {
      const openDate = new Date(item.created_at).getTime();
      const matchesSearch =
        !search ||
        item.protocol.toLowerCase().includes(search) ||
        item.subject.toLowerCase().includes(search) ||
        (item.reporter_name ?? "").toLowerCase().includes(search);
      const matchesStatus = filters.status === "all" || item.status === filters.status;
      const matchesCategory = filters.category === "all" || item.category === filters.category;
      const matchesRisk = filters.risk === "all" || item.risk_level === filters.risk;
      const matchesOrigin =
        filters.origin === "all" ||
        (filters.origin === "anonymous" ? item.is_anonymous : !item.is_anonymous);
      const matchesStart = start === null || openDate >= start;
      const matchesEnd = end === null || openDate <= end;

      return matchesSearch && matchesStatus && matchesCategory && matchesRisk && matchesOrigin && matchesStart && matchesEnd;
    });
  }, [cases, filters]);

  const orderedCases = useMemo(() => sortCases(filteredCases, sort), [filteredCases, sort]);
  const pageCount = Math.max(1, Math.ceil(orderedCases.length / PAGE_SIZE));
  const pagedCases = orderedCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId) ?? null, [cases, selectedCaseId]);
  const summary = useMemo(() => buildSummary(cases), [cases]);

  function handleSort(key: EthicsCasesSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "created_at" || key === "last_update_at" ? "desc" : "asc" },
    );
  }

  function mergeCaseUpdate(updated: EthicsCaseRecord) {
    setCases((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedCaseId(updated.id);
  }

  async function persistUpdate(caseId: string, payload: RequestInit["body"], fallback: (current: EthicsCaseRecord) => EthicsCaseRecord) {
    const currentCase = cases.find((item) => item.id === caseId);
    if (!currentCase) return;

    if (initialData.source === "mock") {
      mergeCaseUpdate(fallback(currentCase));
      setFeedback("Atualização aplicada em modo mock. Para persistir de fato, ligue a feature às tabelas reais do Supabase.");
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/ethics-cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const json = (await response.json()) as { item?: EthicsCaseRecord; error?: string };
      if (!response.ok || !json.item) throw new Error(json.error ?? "Falha ao atualizar o caso.");
      mergeCaseUpdate(json.item);
      setFeedback("Caso atualizado com sucesso.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao atualizar o caso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.35)]">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-950 text-white">
              <ShieldCheck size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Canal de Ética</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Gerencie denúncias, acompanhe tratativas e registre atualizações com rastreabilidade.
              </p>
            </div>
          </div>
          <div className="max-w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 xl:max-w-[340px]">
            Perfis com acesso: <span className="font-semibold text-slate-900">admin, rh e compliance</span>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{feedback}</span>
        </div>
      ) : null}

      <EthicsSummaryCards summary={summary} />

      <EthicsFilters
        filters={filters}
        categories={categories}
        onChange={(patch) => {
          setFilters((current) => ({ ...current, ...patch }));
          setPage(1);
        }}
        onReset={() => {
          setFilters(DEFAULT_FILTERS);
          setPage(1);
        }}
      />

      {pagedCases.length ? (
        <EthicsCasesTable
          cases={pagedCases}
          page={page}
          pageCount={pageCount}
          sort={sort}
          onSort={handleSort}
          onPageChange={setPage}
          onView={(item) => setSelectedCaseId(item.id)}
        />
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-[0_14px_32px_-24px_rgba(15,23,42,0.28)]">
          <p className="text-lg font-semibold text-slate-900">Nenhum registro encontrado</p>
          <p className="mt-2 text-sm text-slate-500">Ajuste os filtros para visualizar outros casos ou aguarde novos registros.</p>
        </section>
      )}

      <EthicsCaseDetailsDrawer
        open={!!selectedCase}
        item={selectedCase}
        assignees={initialData.assignees}
        saving={saving || !canManage}
        onClose={() => setSelectedCaseId(null)}
        onUpdateStatus={(status, comment) => {
          if (!selectedCase) return;
          void persistUpdate(
            selectedCase.id,
            JSON.stringify({ action: "status", status, comment }),
            (current) => {
              const now = new Date().toISOString();
              return {
                ...current,
                status,
                updated_at: now,
                last_update_at: now,
                history: [
                  {
                    id: `mock-status-${now}`,
                    case_id: current.id,
                    previous_status: current.status,
                    new_status: status,
                    comment: comment || null,
                    changed_by: "local-user",
                    changed_by_name: "Usuário atual",
                    created_at: now,
                  },
                  ...current.history,
                ],
              };
            },
          );
        }}
        onAssign={(assignedTo, comment) => {
          if (!selectedCase) return;
          void persistUpdate(
            selectedCase.id,
            JSON.stringify({ action: "assign", assignedTo, comment }),
            (current) => {
              const now = new Date().toISOString();
              const assignedName = initialData.assignees.find((item) => item.id === assignedTo)?.name ?? null;
              return {
                ...current,
                assigned_to: assignedTo,
                assigned_to_name: assignedName,
                updated_at: now,
                last_update_at: now,
                history: [
                  {
                    id: `mock-assign-${now}`,
                    case_id: current.id,
                    previous_status: current.status,
                    new_status: current.status,
                    comment: comment || `Responsável atualizado para ${assignedName ?? "não atribuído"}.`,
                    changed_by: "local-user",
                    changed_by_name: "Usuário atual",
                    created_at: now,
                  },
                  ...current.history,
                ],
              };
            },
          );
        }}
        onNote={(comment) => {
          if (!selectedCase) return;
          void persistUpdate(
            selectedCase.id,
            JSON.stringify({ action: "note", comment }),
            (current) => {
              const now = new Date().toISOString();
              return {
                ...current,
                updated_at: now,
                last_update_at: now,
                history: [
                  {
                    id: `mock-note-${now}`,
                    case_id: current.id,
                    previous_status: current.status,
                    new_status: current.status,
                    comment,
                    changed_by: "local-user",
                    changed_by_name: "Usuário atual",
                    created_at: now,
                  },
                  ...current.history,
                ],
              };
            },
          );
        }}
        onCloseCase={(comment) => {
          if (!selectedCase) return;
          void persistUpdate(
            selectedCase.id,
            JSON.stringify({ action: "close", comment }),
            (current) => {
              const now = new Date().toISOString();
              return {
                ...current,
                status: "Encerrado",
                updated_at: now,
                last_update_at: now,
                closed_at: now,
                history: [
                  {
                    id: `mock-close-${now}`,
                    case_id: current.id,
                    previous_status: current.status,
                    new_status: "Encerrado",
                    comment: comment || "Caso encerrado.",
                    changed_by: "local-user",
                    changed_by_name: "Usuário atual",
                    created_at: now,
                  },
                  ...current.history,
                ],
              };
            },
          );
        }}
      />
    </div>
  );
}
