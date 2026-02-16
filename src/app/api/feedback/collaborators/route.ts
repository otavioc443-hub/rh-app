import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type CollaboratorOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

async function enrichWithCollaboradorName(rows: CollaboratorOption[]) {
  if (rows.length === 0) return rows;

  const emails = Array.from(
    new Set(rows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean))
  );
  if (emails.length === 0) return rows;

  const { data: colabs } = await supabaseAdmin
    .from("colaboradores")
    .select("email,nome")
    .in("email", emails);

  const nameByEmail = new Map<string, string>();
  for (const c of colabs ?? []) {
    const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
    const nome = typeof c.nome === "string" ? c.nome.trim() : "";
    if (email && nome) nameByEmail.set(email, nome);
  }

  return rows.map((r) => {
    const emailKey = (r.email ?? "").trim().toLowerCase();
    const fallbackName = emailKey ? nameByEmail.get(emailKey) ?? null : null;
    const currentName = typeof r.full_name === "string" ? r.full_name.trim() : "";
    const fullNameLooksLikeEmail = currentName.includes("@");

    if ((!currentName || fullNameLooksLikeEmail) && fallbackName) {
      return { ...r, full_name: fallbackName };
    }
    return r;
  });
}

export async function GET(req: Request) {
  const guard = await requireRoles(["coordenador", "gestor", "rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const targetRoleRaw = url.searchParams.get("targetRole");
  const targetRole =
    targetRoleRaw === "coordenador" || targetRoleRaw === "colaborador" ? targetRoleRaw : "colaborador";

  if (guard.role === "rh" || guard.role === "admin") {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .eq("active", true)
      .eq("role", targetRole)
      .order("full_name", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const rows = await enrichWithCollaboradorName((data ?? []) as CollaboratorOption[]);
    return NextResponse.json({ ok: true, rows });
  }

  // 1) Regra principal: subordinados diretos (manager_id)
  const { data: byManager, error: managerErr } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,email")
    .eq("active", true)
    .eq("role", targetRole)
    .eq("manager_id", guard.userId)
    .order("full_name", { ascending: true });
  if (managerErr) return NextResponse.json({ error: managerErr.message }, { status: 400 });
  if ((byManager ?? []).length > 0) {
    const rows = await enrichWithCollaboradorName((byManager ?? []) as CollaboratorOption[]);
    return NextResponse.json({ ok: true, rows });
  }

  // 2) Fallback por cadastro RH (colaboradores.email_superior_direto -> profiles.email)
  if (guard.email) {
    const { data: links, error: linksErr } = await supabaseAdmin
      .from("colaboradores")
      .select("email,email_superior_direto,is_active")
      .ilike("email_superior_direto", guard.email)
      .or("is_active.is.null,is_active.eq.true");
    if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 400 });

    const emails = Array.from(
      new Set(
        (links ?? [])
          .map((r) => (typeof r.email === "string" ? r.email.trim().toLowerCase() : ""))
          .filter(Boolean)
      )
    );

    if (emails.length > 0) {
      const { data: byEmail, error: byEmailErr } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name,email")
        .eq("active", true)
        .eq("role", targetRole)
        .in("email", emails)
        .order("full_name", { ascending: true });
      if (byEmailErr) return NextResponse.json({ error: byEmailErr.message }, { status: 400 });
      if ((byEmail ?? []).length > 0) {
        const rows = await enrichWithCollaboradorName((byEmail ?? []) as CollaboratorOption[]);
        return NextResponse.json({ ok: true, rows });
      }
    }
  }

  // 3) Fallback legado por departamento/empresa
  let legacyQuery = supabaseAdmin
    .from("profiles")
    .select("id,full_name,email")
    .eq("active", true)
    .eq("role", targetRole)
    .order("full_name", { ascending: true });
  if (guard.role === "coordenador" && guard.departmentId) {
    legacyQuery = legacyQuery.eq("department_id", guard.departmentId);
  }
  if (guard.role === "gestor" && guard.companyId) {
    legacyQuery = legacyQuery.eq("company_id", guard.companyId);
  }

  const { data: legacyRows, error: legacyErr } = await legacyQuery;
  if (legacyErr) return NextResponse.json({ error: legacyErr.message }, { status: 400 });
  const rows = await enrichWithCollaboradorName((legacyRows ?? []) as CollaboratorOption[]);
  return NextResponse.json({ ok: true, rows });
}
