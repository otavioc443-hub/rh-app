import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type TeamRole = "coordenador" | "gestor";
type PdiStatus = "planejado" | "em_andamento" | "concluido";

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type PdiRow = {
  id: string;
  user_id: string;
  title: string;
  action: string | null;
  target_date: string | null;
  status: PdiStatus;
  created_at: string;
};

function normalizeDisplayName(value: string | null | undefined) {
  const name = String(value ?? "").trim();
  if (!name) return null;
  if (name.includes("@")) return null;
  return name;
}

async function resolveTeamMembers(
  role: TeamRole,
  userId: string,
  userEmail: string | null,
  companyId: string | null,
  departmentId: string | null
) {
  const targetRole = role === "coordenador" ? "colaborador" : "coordenador";

  const byId = new Map<string, TeamMember>();
  const addRows = (rows: Array<{ id: string; full_name: string | null; email: string | null }>) => {
    for (const row of rows) {
      if (!byId.has(row.id)) byId.set(row.id, { id: row.id, full_name: normalizeDisplayName(row.full_name), email: row.email });
    }
  };

  const { data: direct, error: directErr } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,email")
    .eq("active", true)
    .eq("role", targetRole)
    .eq("manager_id", userId)
    .order("full_name", { ascending: true });
  if (directErr) throw new Error(directErr.message);
  addRows((direct ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>);

  if (byId.size === 0 && userEmail) {
    const { data: links, error: linksErr } = await supabaseAdmin
      .from("colaboradores")
      .select("email,email_superior_direto,is_active")
      .ilike("email_superior_direto", userEmail)
      .or("is_active.is.null,is_active.eq.true");
    if (linksErr) throw new Error(linksErr.message);

    const emails = Array.from(
      new Set(
        (links ?? [])
          .map((r) => (typeof r.email === "string" ? r.email.trim().toLowerCase() : ""))
          .filter(Boolean)
      )
    );
    if (emails.length) {
      const { data: byEmail, error: byEmailErr } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name,email")
        .eq("active", true)
        .eq("role", targetRole)
        .in("email", emails)
        .order("full_name", { ascending: true });
      if (byEmailErr) throw new Error(byEmailErr.message);
      addRows((byEmail ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>);
    }
  }

  if (byId.size === 0) {
    let fallbackQuery = supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .eq("active", true)
      .eq("role", targetRole)
      .order("full_name", { ascending: true });
    if (role === "coordenador" && departmentId) fallbackQuery = fallbackQuery.eq("department_id", departmentId);
    if (role === "gestor" && companyId) fallbackQuery = fallbackQuery.eq("company_id", companyId);

    const { data: fallbackRows, error: fallbackErr } = await fallbackQuery;
    if (fallbackErr) throw new Error(fallbackErr.message);
    addRows((fallbackRows ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>);
  }

  const ids = Array.from(byId.keys());
  if (ids.length) {
    const { data: collabs } = await supabaseAdmin.from("colaboradores").select("user_id,nome,email").in("user_id", ids);
    for (const c of (collabs ?? []) as Array<{ user_id: string | null; nome: string | null; email: string | null }>) {
      if (!c.user_id || !byId.has(c.user_id)) continue;
      const current = byId.get(c.user_id)!;
      byId.set(c.user_id, {
        id: current.id,
        full_name: current.full_name ?? normalizeDisplayName(c.nome),
        email: current.email ?? c.email,
      });
    }
  }

  return Array.from(byId.values());
}

export async function GET() {
  const guard = await requireRoles(["coordenador", "gestor", "rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  if (guard.role !== "coordenador" && guard.role !== "gestor") {
    return NextResponse.json({ error: "Acesso restrito a coordenador/gestor." }, { status: 403 });
  }

  try {
    const teamMembers = await resolveTeamMembers(guard.role, guard.userId, guard.email, guard.companyId, guard.departmentId);
    const teamIds = teamMembers.map((m) => m.id);

    const itemsByUser = new Map<string, PdiRow[]>();
    if (teamIds.length > 0) {
      const { data: pdiRows, error: pdiErr } = await supabaseAdmin
        .from("pdi_items")
        .select("id,user_id,title,action,target_date,status,created_at")
        .in("user_id", teamIds)
        .order("created_at", { ascending: false });
      if (pdiErr) return NextResponse.json({ error: pdiErr.message }, { status: 400 });

      for (const row of (pdiRows ?? []) as PdiRow[]) {
        const list = itemsByUser.get(row.user_id) ?? [];
        list.push(row);
        itemsByUser.set(row.user_id, list);
      }
    }

    const rows = teamMembers.map((member) => ({
      user_id: member.id,
      collaborator_name: member.full_name ?? member.email ?? "Sem nome cadastrado",
      collaborator_email: member.email,
      items: itemsByUser.get(member.id) ?? [],
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const guard = await requireRoles(["coordenador", "gestor", "rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  if (guard.role !== "coordenador" && guard.role !== "gestor") {
    return NextResponse.json({ error: "Acesso restrito a coordenador/gestor." }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { pdi_id?: string; status?: PdiStatus };
    const pdiId = String(body.pdi_id ?? "").trim();
    const nextStatus = body.status;
    if (!pdiId) return NextResponse.json({ error: "pdi_id obrigatorio." }, { status: 400 });
    if (nextStatus !== "planejado" && nextStatus !== "em_andamento" && nextStatus !== "concluido") {
      return NextResponse.json({ error: "status invalido." }, { status: 400 });
    }

    const { data: pdiItem, error: pdiErr } = await supabaseAdmin
      .from("pdi_items")
      .select("id,user_id")
      .eq("id", pdiId)
      .maybeSingle<{ id: string; user_id: string }>();
    if (pdiErr) return NextResponse.json({ error: pdiErr.message }, { status: 400 });
    if (!pdiItem) return NextResponse.json({ error: "Item de PDI nao encontrado." }, { status: 404 });

    const teamMembers = await resolveTeamMembers(guard.role, guard.userId, guard.email, guard.companyId, guard.departmentId);
    const allowedIds = new Set(teamMembers.map((m) => m.id));
    if (!allowedIds.has(pdiItem.user_id)) {
      return NextResponse.json({ error: "Sem permissao para atualizar este PDI." }, { status: 403 });
    }

    const { error: updateErr } = await supabaseAdmin.from("pdi_items").update({ status: nextStatus }).eq("id", pdiId);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
