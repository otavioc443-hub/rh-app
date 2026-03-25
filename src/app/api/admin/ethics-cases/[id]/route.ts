import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { EthicsCaseRecord, EthicsCaseStatus, EthicsCaseUpdatePayload } from "@/lib/ethicsCases/types";

type CaseRow = {
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

async function readCase(caseId: string): Promise<EthicsCaseRecord | null> {
  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from("ethics_cases")
    .select(
      "id,company_id,protocol,subject,description,category,risk_level,status,is_anonymous,reporter_name,reporter_email,assigned_to,created_at,updated_at,closed_at",
    )
    .eq("id", caseId)
    .maybeSingle<CaseRow>();

  if (caseError) throw caseError;
  if (!caseRow) return null;

  const [historyRes, assignedRes] = await Promise.all([
    supabaseAdmin
      .from("ethics_case_history")
      .select("id,case_id,previous_status,new_status,comment,changed_by,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    caseRow.assigned_to
      ? supabaseAdmin.from("profiles").select("id,full_name").eq("id", caseRow.assigned_to).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (historyRes.error) throw historyRes.error;
  if (assignedRes.error) throw assignedRes.error;

  const actorIds = (historyRes.data ?? []).map((item) => item.changed_by).filter(Boolean) as string[];
  const actorsRes = actorIds.length
    ? await supabaseAdmin.from("profiles").select("id,full_name").in("id", actorIds)
    : { data: [], error: null };

  if (actorsRes.error) throw actorsRes.error;

  const names = new Map<string, string>();
  for (const row of (actorsRes.data ?? []) as Array<{ id: string; full_name: string | null }>) {
    names.set(row.id, row.full_name ?? "Usuario nao identificado");
  }

  return {
    id: caseRow.id,
    company_id: caseRow.company_id,
    protocol: caseRow.protocol,
    subject: caseRow.subject,
    description: caseRow.description ?? "",
    category: caseRow.category ?? "Nao classificado",
    risk_level: (caseRow.risk_level as EthicsCaseRecord["risk_level"]) ?? "Médio",
    status: (caseRow.status as EthicsCaseRecord["status"]) ?? "Recebido",
    is_anonymous: caseRow.is_anonymous === true,
    reporter_name: caseRow.reporter_name,
    reporter_email: caseRow.reporter_email,
    assigned_to: caseRow.assigned_to,
    assigned_to_name: assignedRes.data?.full_name ?? null,
    created_at: caseRow.created_at ?? new Date().toISOString(),
    updated_at: caseRow.updated_at ?? caseRow.created_at ?? new Date().toISOString(),
    closed_at: caseRow.closed_at,
    last_update_at:
      historyRes.data?.[0]?.created_at ?? caseRow.updated_at ?? caseRow.created_at ?? new Date().toISOString(),
    attachments: [],
    history: (historyRes.data ?? []).map((item) => ({
      id: item.id,
      case_id: item.case_id,
      previous_status: (item.previous_status as EthicsCaseStatus | null) ?? null,
      new_status: (item.new_status as EthicsCaseStatus) ?? "Recebido",
      comment: item.comment,
      changed_by: item.changed_by,
      changed_by_name: item.changed_by ? names.get(item.changed_by) ?? "Usuario nao identificado" : null,
      created_at: item.created_at ?? new Date().toISOString(),
    })),
  };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["admin", "rh", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { id } = await context.params;
    const body = (await request.json()) as EthicsCaseUpdatePayload;

    const { data: currentRow, error: currentError } = await supabaseAdmin
      .from("ethics_cases")
      .select("id,company_id,status,assigned_to")
      .eq("id", id)
      .maybeSingle<{ id: string; company_id: string; status: EthicsCaseStatus | null; assigned_to: string | null }>();

    if (currentError) throw currentError;
    if (!currentRow) return NextResponse.json({ error: "Caso nao encontrado." }, { status: 404 });
    if (access.companyId && currentRow.company_id !== access.companyId) {
      return NextResponse.json({ error: "Caso fora do escopo da sua empresa." }, { status: 403 });
    }

    const previousStatus = currentRow.status ?? "Recebido";
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    let nextStatus: EthicsCaseStatus = previousStatus;
    let historyComment: string | null = null;

    if (body.action === "status") {
      patch.status = body.status;
      patch.closed_at = body.status === "Encerrado" ? now : null;
      nextStatus = body.status;
      historyComment = body.comment ?? null;
    }

    if (body.action === "assign") {
      if (body.assignedTo) {
        let assigneeQuery = supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", body.assignedTo)
          .eq("active", true)
          .in("role", ["admin", "rh", "compliance"]);

        if (currentRow.company_id) {
          assigneeQuery = assigneeQuery.eq("company_id", currentRow.company_id);
        }

        const { data: assigneeRow, error: assigneeError } = await assigneeQuery.maybeSingle();
        if (assigneeError) throw assigneeError;
        if (!assigneeRow) {
          return NextResponse.json({ error: "Responsavel invalido para a empresa do caso." }, { status: 400 });
        }
      }

      patch.assigned_to = body.assignedTo;
      historyComment = body.comment ?? (body.assignedTo ? "Responsavel atribuido." : "Responsavel removido.");
    }

    if (body.action === "note") {
      historyComment = body.comment;
    }

    if (body.action === "close") {
      patch.status = "Encerrado";
      patch.closed_at = now;
      nextStatus = "Encerrado";
      historyComment = body.comment ?? "Caso encerrado.";
    }

    const { error: updateError } = await supabaseAdmin.from("ethics_cases").update(patch).eq("id", id);
    if (updateError) throw updateError;

    const { error: historyError } = await supabaseAdmin.from("ethics_case_history").insert({
      case_id: id,
      previous_status: previousStatus,
      new_status: nextStatus,
      comment: historyComment,
      changed_by: access.userId,
      created_at: now,
    });

    if (historyError) throw historyError;

    const item = await readCase(id);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar o caso." },
      { status: 500 },
    );
  }
}
