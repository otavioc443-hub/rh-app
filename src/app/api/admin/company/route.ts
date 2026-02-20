import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "colaborador" | "rh" | "admin";

// --------- guard (só ADMIN) ----------
async function requireRole(req: Request, allowedRoles: Role[]) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return { ok: false as const, status: 401, error: "Token ausente." };
  }

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = userRes?.user;

  if (userErr || !user) {
    return { ok: false as const, status: 401, error: "Token inválido." };
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role, active, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return { ok: false as const, status: 403, error: "Perfil não encontrado/sem permissão." };
  }

  if (!profile.active) {
    return { ok: false as const, status: 403, error: "Usuário inativo." };
  }

  const role = profile.role as Role;
  if (!allowedRoles.includes(role)) {
    return { ok: false as const, status: 403, error: "Acesso negado." };
  }

  return { ok: true as const, userId: user.id, role, companyId: profile.company_id as string | null };
}

// --------- GET: lista empresas ----------
export async function GET(req: Request) {
  const guard = await requireRole(req, ["admin", "rh"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const baseQuery = supabaseAdmin
    .from("companies")
    .select("id, name, logo_url, primary_color, created_at")
    .order("name", { ascending: true });
  const { data, error } =
    guard.role === "admin" ? await baseQuery : guard.companyId ? await baseQuery.eq("id", guard.companyId) : await baseQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ companies: data ?? [] });
}

// --------- POST: cria empresa ----------
export async function POST(req: Request) {
  const guard = await requireRole(req, ["admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const logo_url = body.logo_url ? String(body.logo_url).trim() : null;
    const primary_color = body.primary_color ? String(body.primary_color).trim() : "#111827";
    const tenantAdminUserId = body.tenant_admin_user_id ? String(body.tenant_admin_user_id).trim() : "";

    if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

    if (tenantAdminUserId) {
      const { data: createdByAdmin, error: createErr } = await supabaseAdmin
        .from("companies")
        .insert({ name, logo_url, primary_color })
        .select("id, name, logo_url, primary_color, created_at")
        .maybeSingle();
      if (createErr || !createdByAdmin?.id) {
        return NextResponse.json({ error: createErr?.message ?? "Falha ao criar empresa." }, { status: 400 });
      }

      const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
        {
          id: tenantAdminUserId,
          role: "admin",
          active: true,
          company_id: createdByAdmin.id,
        },
        { onConflict: "id" }
      );
      if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 });

      return NextResponse.json({ ok: true, company: createdByAdmin });
    }

    const { data, error } = await supabaseAdmin
      .from("companies")
      .insert({ name, logo_url, primary_color })
      .select("id, name, logo_url, primary_color, created_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, company: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --------- PUT: atualiza empresa ----------
export async function PUT(req: Request) {
  const guard = await requireRole(req, ["admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const logo_url = body.logo_url ? String(body.logo_url).trim() : null;
    const primary_color = body.primary_color ? String(body.primary_color).trim() : "#111827";

    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

    const updateQuery = supabaseAdmin
      .from("companies")
      .update({ name, logo_url, primary_color })
      .eq("id", id);
    const { data, error } = await updateQuery.select("id, name, logo_url, primary_color, created_at").maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, company: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --------- DELETE: remove empresa ----------
export async function DELETE(req: Request) {
  const guard = await requireRole(req, ["admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

    const { error } = await supabaseAdmin.from("companies").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
