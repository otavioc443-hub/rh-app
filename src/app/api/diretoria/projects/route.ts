import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "colaborador" | "coordenador" | "gestor" | "diretoria" | "rh" | "financeiro" | "pd" | "admin";
type ProjectLine = "eolica" | "solar" | "bess";
type ProjectModality = "basico" | "executivo" | "eng_proprietario" | "consultoria";
type ProjectStage = "ofertas" | "desenvolvimento" | "as_built" | "pausado" | "cancelado";
type ProjectStatus = "active" | "paused" | "done";
type DeliverableDiscipline = "civil" | "bim" | "eletromecanico";

type DeliverableInput = {
  title: string;
  description: string | null;
  due_date: string | null;
  discipline_code: DeliverableDiscipline | null;
  currency_code: "BRL" | "USD" | "EUR";
  actual_amount: number | null;
};

type CreateProjectBody = {
  name?: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget_total?: number | null;
  client_id?: string | null;
  project_line?: ProjectLine | null;
  project_type?: ProjectModality | null;
  project_scopes?: string[] | null;
  project_stage?: ProjectStage;
  status?: ProjectStatus;
  owner_user_id?: string;
  company_id?: string | null;
  secondary_manager_user_ids?: string[];
  deliverables?: DeliverableInput[];
};

async function requireRole(req: NextRequest, allowedRoles: Role[]) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { ok: false as const, status: 401, error: "Token ausente." };

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) return { ok: false as const, status: 401, error: "Token invalido." };

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role, active, company_id")
    .eq("id", user.id)
    .maybeSingle<{ role: Role; active: boolean | null; company_id: string | null }>();

  if (profileErr || !profile) return { ok: false as const, status: 403, error: "Perfil nao encontrado." };
  if (profile.active === false) return { ok: false as const, status: 403, error: "Usuario inativo." };
  if (!allowedRoles.includes(profile.role)) return { ok: false as const, status: 403, error: "Acesso negado." };

  return {
    ok: true as const,
    userId: user.id,
    role: profile.role,
    companyId: profile.company_id,
  };
}

function allocateEvenlyByCents(total: number | null | undefined, count: number) {
  const safeCount = Math.max(0, count);
  if (!safeCount) return [] as number[];
  const totalValue = Number(total ?? 0);
  if (!Number.isFinite(totalValue) || totalValue <= 0) return Array.from({ length: safeCount }, () => 0);
  const totalCents = Math.round(totalValue * 100);
  const baseCents = Math.floor(totalCents / safeCount);
  let remainder = totalCents - baseCents * safeCount;
  return Array.from({ length: safeCount }, () => {
    const cents = baseCents + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return cents / 100;
  });
}

function normalizeDeliverables(rows: DeliverableInput[] | undefined, budgetTotal: number | null) {
  const normalized = (rows ?? [])
    .map((row) => ({
      title: String(row.title ?? "").trim(),
      description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : null,
      due_date: typeof row.due_date === "string" && row.due_date.trim() ? row.due_date.trim() : null,
      discipline_code:
        row.discipline_code === "civil" || row.discipline_code === "bim" || row.discipline_code === "eletromecanico"
          ? row.discipline_code
          : null,
      currency_code:
        row.currency_code === "USD" || row.currency_code === "EUR" || row.currency_code === "BRL"
          ? row.currency_code
          : "BRL",
      actual_amount: Number.isFinite(Number(row.actual_amount)) ? Number(row.actual_amount) : null,
    }))
    .filter((row) => row.title.length > 0);

  const fallbackAllocations = allocateEvenlyByCents(budgetTotal, normalized.length);
  return normalized.map((row, index) => ({
    ...row,
    status: "pending" as const,
    budget_amount: null,
    actual_amount: row.actual_amount ?? (fallbackAllocations[index] > 0 ? fallbackAllocations[index] : null),
  }));
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(req, ["diretoria", "admin"]);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const body = (await req.json()) as CreateProjectBody;
    const name = String(body.name ?? "").trim();
    const clientId = String(body.client_id ?? "").trim();
    const ownerUserId = String(body.owner_user_id ?? "").trim();
    const projectLine = body.project_line;
    const projectType = body.project_type;
    const projectStage = body.project_stage ?? "ofertas";
    const status = body.status ?? "paused";
    const budgetTotal = Number.isFinite(Number(body.budget_total)) ? Number(body.budget_total) : null;
    const additionalManagerIds = Array.from(new Set((body.secondary_manager_user_ids ?? []).map((id) => String(id).trim()).filter(Boolean)));

    if (!name) return NextResponse.json({ error: "Nome do projeto obrigatorio." }, { status: 400 });
    if (!clientId) return NextResponse.json({ error: "Cliente obrigatorio." }, { status: 400 });
    if (!ownerUserId) return NextResponse.json({ error: "Gestor responsavel obrigatorio." }, { status: 400 });
    if (!projectLine || !["eolica", "solar", "bess"].includes(projectLine)) {
      return NextResponse.json({ error: "Linha do projeto invalida." }, { status: 400 });
    }
    if (!projectType || !["basico", "executivo", "eng_proprietario", "consultoria"].includes(projectType)) {
      return NextResponse.json({ error: "Modalidade do projeto invalida." }, { status: 400 });
    }
    if (additionalManagerIds.includes(ownerUserId)) {
      return NextResponse.json({ error: "Gestor adicional deve ser diferente do gestor principal." }, { status: 400 });
    }

    const deliverables = normalizeDeliverables(body.deliverables, budgetTotal);
    const projectScopes = Array.isArray(body.project_scopes)
      ? body.project_scopes.filter((value) => value === "civil" || value === "bim" || value === "eletromecanico")
      : [];
    const managerIds = Array.from(new Set([ownerUserId, ...additionalManagerIds]));

    const { data: validManagers, error: validManagersErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("id", managerIds)
      .eq("active", true);
    if (validManagersErr) {
      return NextResponse.json({ error: validManagersErr.message }, { status: 400 });
    }
    const validManagerIds = new Set((validManagers ?? []).map((row) => String((row as { id: string }).id)));
    if (!validManagerIds.has(ownerUserId)) {
      return NextResponse.json(
        { error: "Gestor responsavel invalido. Selecione um usuario com acesso ativo ao portal." },
        { status: 400 }
      );
    }
    const invalidAdditionalManagers = additionalManagerIds.filter((id) => !validManagerIds.has(id));
    if (invalidAdditionalManagers.length > 0) {
      return NextResponse.json(
        { error: "Ha gestor(es) adicional(is) sem acesso ativo ao portal. Revise a selecao e tente novamente." },
        { status: 400 }
      );
    }

    const { data: insertedProject, error: insertProjectErr } = await supabaseAdmin
      .from("projects")
      .insert({
        name,
        description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
        start_date: typeof body.start_date === "string" && body.start_date.trim() ? body.start_date.trim() : null,
        end_date: typeof body.end_date === "string" && body.end_date.trim() ? body.end_date.trim() : null,
        budget_total: budgetTotal,
        client_id: clientId,
        project_line: projectLine,
        project_type: projectType,
        project_scopes: projectScopes,
        project_stage: projectStage,
        status,
        owner_user_id: ownerUserId,
        company_id: body.company_id ?? guard.companyId ?? null,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertProjectErr || !insertedProject?.id) {
      return NextResponse.json({ error: insertProjectErr?.message ?? "Falha ao criar projeto." }, { status: 400 });
    }

    const projectId = insertedProject.id;
    if (managerIds.length > 0) {
      const membersPayload = managerIds.map((managerId) => ({
        project_id: projectId,
        user_id: managerId,
        member_role: "gestor",
        added_by: guard.userId,
      }));
      const membersRes = await supabaseAdmin
        .from("project_members")
        .upsert(membersPayload, { onConflict: "project_id,user_id" });
      if (membersRes.error) {
        return NextResponse.json({ error: membersRes.error.message }, { status: 400 });
      }
    }

    if (deliverables.length > 0) {
      const deliverablesRes = await supabaseAdmin.from("project_deliverables").insert(
        deliverables.map((row) => ({
          project_id: projectId,
          title: row.title,
          description: row.description,
          due_date: row.due_date,
          status: row.status,
          discipline_code: row.discipline_code,
          currency_code: row.currency_code,
          budget_amount: row.budget_amount,
          actual_amount: row.actual_amount,
        }))
      );
      if (deliverablesRes.error) {
        return NextResponse.json({ error: deliverablesRes.error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, id: projectId, createdDeliverables: deliverables.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado ao criar projeto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireRole(req, ["diretoria", "admin"]);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const body = (await req.json()) as { project_id?: string };
    const projectId = String(body.project_id ?? "").trim();
    if (!projectId) return NextResponse.json({ error: "project_id obrigatorio." }, { status: 400 });

    const deleteRes = await supabaseAdmin.from("projects").delete().eq("id", projectId);
    if (deleteRes.error) {
      return NextResponse.json(
        {
          error:
            "Nao foi possivel excluir o projeto. Verifique se ele possui dados vinculados (medicoes, membros, entregaveis ou financeiros) e remova essas dependencias antes de excluir.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado ao excluir projeto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
