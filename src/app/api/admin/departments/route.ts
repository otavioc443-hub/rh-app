import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "colaborador" | "rh" | "admin";

async function requireRole(req: Request, allowedRoles: Role[]) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return { ok: false as const, status: 401, error: "Token ausente." };

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = userRes?.user;

  if (userErr || !user) return { ok: false as const, status: 401, error: "Token inválido." };

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) return { ok: false as const, status: 403, error: "Perfil inválido." };
  if (!profile.active) return { ok: false as const, status: 403, error: "Usuário inativo." };
  const role = profile.role as Role;
  if (!allowedRoles.includes(role)) return { ok: false as const, status: 403, error: "Acesso negado." };

  return { ok: true as const, userId: user.id, role };
}

export async function GET(req: Request) {
  const guard = await requireRole(req, ["admin", "rh"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const company_id = url.searchParams.get("company_id");

  if (!company_id) return NextResponse.json({ error: "company_id é obrigatório." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("id, company_id, name, created_at")
    .eq("company_id", company_id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ departments: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireRole(req, ["admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const company_id = String(body.company_id || "").trim();
    const name = String(body.name || "").trim();

    if (!company_id || !name) {
      return NextResponse.json({ error: "company_id e name são obrigatórios." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .insert({ company_id, name })
      .select("id, company_id, name, created_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, department: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const guard = await requireRole(req, ["admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

    const { error } = await supabaseAdmin.from("departments").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
