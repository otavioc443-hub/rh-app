import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMockEthicsDashboardData } from "@/lib/ethicsCases/mock";
import type {
  EthicsCaseHistoryEntry,
  EthicsCaseRecord,
  EthicsDashboardData,
  EthicsSummary,
} from "@/lib/ethicsCases/types";

type EthicsCaseRow = {
  id: string;
  company_id: string;
  protocol: string;
  subject: string;
  description: string | null;
  category: string | null;
  risk_level: string | null;
  status: string | null;
  is_anonymous: boolean | null;
  reporter_name: string | null;
  reporter_email: string | null;
  assigned_to: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
};

type EthicsHistoryRow = {
  id: string;
  case_id: string;
  previous_status: string | null;
  new_status: string | null;
  comment: string | null;
  changed_by: string | null;
  created_at: string | null;
};

function isMissingRelationError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("relation") ||
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("ethics_cases") ||
    text.includes("ethics_case_history")
  );
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

  for (const item of cases) {
    if (item.status in byStatus) byStatus[item.status] += 1;
  }

  return { total: cases.length, byStatus };
}

export async function getEthicsDashboardData(companyId?: string | null): Promise<EthicsDashboardData> {
  try {
    let query = supabaseAdmin
      .from("ethics_cases")
      .select(
        "id,company_id,protocol,subject,description,category,risk_level,status,is_anonymous,reporter_name,reporter_email,assigned_to,created_at,updated_at,closed_at",
      )
      .order("created_at", { ascending: false });
    if (companyId) query = query.eq("company_id", companyId);
    const { data: casesRows, error: casesError } = await query;

    if (casesError) {
      if (isMissingRelationError(casesError.message)) return getMockEthicsDashboardData();
      throw casesError;
    }

    const rows = (casesRows ?? []) as EthicsCaseRow[];
    const caseIds = rows.map((item) => item.id);
    const assigneeIds = rows.map((item) => item.assigned_to).filter(Boolean) as string[];

    const [historyRes, assigneesRes] = await Promise.all([
      caseIds.length
        ? supabaseAdmin
            .from("ethics_case_history")
            .select("id,case_id,previous_status,new_status,comment,changed_by,created_at")
            .in("case_id", caseIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      companyId
        ? supabaseAdmin
            .from("profiles")
            .select("id,full_name")
            .eq("company_id", companyId)
            .in("role", ["admin", "rh", "compliance"])
            .eq("active", true)
        : assigneeIds.length
          ? supabaseAdmin.from("profiles").select("id,full_name").in("id", assigneeIds)
          : Promise.resolve({ data: [], error: null }),
    ]);

    if (historyRes.error) {
      if (isMissingRelationError(historyRes.error.message)) return getMockEthicsDashboardData();
      throw historyRes.error;
    }
    if (assigneesRes.error) throw assigneesRes.error;

    const historyRows = (historyRes.data ?? []) as EthicsHistoryRow[];
    const actorIds = historyRows.map((item) => item.changed_by).filter(Boolean) as string[];

    const actorsRes = actorIds.length
      ? await supabaseAdmin.from("profiles").select("id,full_name").in("id", actorIds)
      : { data: [], error: null };

    if (actorsRes.error) throw actorsRes.error;

    const profileNameById = new Map<string, string>();
    for (const row of [...((assigneesRes.data ?? []) as Array<{ id: string; full_name: string | null }>), ...((actorsRes.data ?? []) as Array<{ id: string; full_name: string | null }>)]) {
      profileNameById.set(row.id, row.full_name ?? "Responsável não identificado");
    }

    const historyByCase = new Map<string, EthicsCaseHistoryEntry[]>();
    for (const item of historyRows) {
      const entry: EthicsCaseHistoryEntry = {
        id: item.id,
        case_id: item.case_id,
        previous_status: (item.previous_status as EthicsCaseHistoryEntry["previous_status"]) ?? null,
        new_status: (item.new_status as EthicsCaseHistoryEntry["new_status"]) ?? "Recebido",
        comment: item.comment,
        changed_by: item.changed_by,
        changed_by_name: item.changed_by ? profileNameById.get(item.changed_by) ?? "Usuário não identificado" : null,
        created_at: item.created_at ?? new Date().toISOString(),
      };
      const bucket = historyByCase.get(item.case_id) ?? [];
      bucket.push(entry);
      historyByCase.set(item.case_id, bucket);
    }

    const cases: EthicsCaseRecord[] = rows.map((item) => {
      const history = historyByCase.get(item.id) ?? [];
      return {
        id: item.id,
        company_id: item.company_id,
        protocol: item.protocol,
        subject: item.subject,
        description: item.description ?? "",
        category: item.category ?? "Não classificado",
        risk_level: (item.risk_level as EthicsCaseRecord["risk_level"]) ?? "Médio",
        status: (item.status as EthicsCaseRecord["status"]) ?? "Recebido",
        is_anonymous: item.is_anonymous === true,
        reporter_name: item.reporter_name,
        reporter_email: item.reporter_email,
        assigned_to: item.assigned_to,
        assigned_to_name: item.assigned_to ? profileNameById.get(item.assigned_to) ?? "Responsável não identificado" : null,
        created_at: item.created_at ?? new Date().toISOString(),
        updated_at: item.updated_at ?? item.created_at ?? new Date().toISOString(),
        closed_at: item.closed_at,
        last_update_at: history[0]?.created_at ?? item.updated_at ?? item.created_at ?? new Date().toISOString(),
        attachments: [],
        history,
      };
    });

    return {
      source: "supabase",
      cases,
      summary: buildSummary(cases),
      assignees: Array.from(
        new Map(
          ((assigneesRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map((row) => [
            row.id,
            { id: row.id, name: row.full_name ?? "Responsável não identificado" },
          ]),
        ).values(),
      ),
      warning: cases.length ? null : "Nenhum caso ético foi encontrado até o momento.",
    };
  } catch (error) {
    const mock = getMockEthicsDashboardData();
    return {
      ...mock,
      warning:
        error instanceof Error
          ? `${mock.warning} Motivo: ${error.message}`
          : mock.warning,
    };
  }
}
