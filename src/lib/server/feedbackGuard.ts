import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSupabase } from "@/lib/server/supabaseServer";

export type AppRole = "colaborador" | "coordenador" | "gestor" | "rh" | "admin";

export type GuardResult =
  | {
      ok: true;
      userId: string;
      email: string | null;
      role: AppRole;
      active: true;
      companyId: string | null;
      departmentId: string | null;
    }
  | { ok: false; status: number; error: string };

export async function requireRoles(allowed: AppRole[]): Promise<GuardResult> {
  const supabaseServer = await getServerSupabase();
  const { data: userRes, error: userErr } = await supabaseServer.auth.getUser();
  const user = userRes?.user;
  if (userErr || !user) return { ok: false, status: 401, error: "Nao autenticado." };

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role, active, company_id, department_id")
    .eq("id", user.id)
    .maybeSingle<{
      role: AppRole | null;
      active: boolean | null;
      company_id: string | null;
      department_id: string | null;
    }>();

  if (profileErr || !profile?.active || !profile.role) {
    return { ok: false, status: 403, error: "Perfil sem permissao." };
  }

  if (!allowed.includes(profile.role)) {
    return { ok: false, status: 403, error: "Acesso negado." };
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email ?? null,
    role: profile.role,
    active: true,
    companyId: profile.company_id,
    departmentId: profile.department_id,
  };
}

