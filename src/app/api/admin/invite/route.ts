import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "colaborador" | "rh" | "admin";
type GuardRole = "admin" | "rh";

async function requireAdminOrRH(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return { ok: false as const, status: 401, error: "Token ausente." };
  }

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = userRes?.user;

  if (userErr || !user) {
    return { ok: false as const, status: 401, error: "Token invalido." };
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle<{ role: GuardRole | null; active: boolean | null }>();

  if (profileErr || !profile) {
    return { ok: false as const, status: 403, error: "Perfil nao encontrado." };
  }

  if (!profile.active) {
    return { ok: false as const, status: 403, error: "Usuario inativo." };
  }

  if (profile.role !== "admin" && profile.role !== "rh") {
    return { ok: false as const, status: 403, error: "Acesso negado." };
  }

  return { ok: true as const, requesterRole: profile.role };
}

export async function POST(req: Request) {
  const guard = await requireAdminOrRH(req);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const role = String(body?.role || "colaborador").trim() as Role;
    const companyId = body?.company_id ? String(body.company_id).trim() : null;
    const departmentId = body?.department_id ? String(body.department_id).trim() : null;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalido." }, { status: 400 });
    }

    if (!["colaborador", "rh", "admin"].includes(role)) {
      return NextResponse.json({ error: "Role invalida." }, { status: 400 });
    }

    if (guard.requesterRole === "rh" && role === "admin") {
      return NextResponse.json(
        { error: "RH nao pode convidar usuario com role admin." },
        { status: 403 }
      );
    }

    const redirectTo =
      process.env.NEXT_PUBLIC_AUTH_REDIRECT_TO || `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo }
    );

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }

    const invitedUserId = inviteData?.user?.id;
    if (!invitedUserId) {
      return NextResponse.json(
        { error: "Convite enviado, mas sem user_id retornado pelo auth." },
        { status: 500 }
      );
    }

    const { error: upsertErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: invitedUserId,
        email,
        role,
        active: true,
        company_id: companyId,
        department_id: departmentId,
      },
      { onConflict: "id" }
    );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      invited_user_id: invitedUserId,
      email,
      role,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
