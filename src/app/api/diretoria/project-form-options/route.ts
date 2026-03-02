import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "colaborador" | "coordenador" | "gestor" | "diretoria" | "rh" | "financeiro" | "pd" | "admin";

type ManagerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ClientRow = {
  id: string;
  name: string;
  company_id: string | null;
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

function managerLabel(m: ManagerRow) {
  const name = (m.full_name ?? "").trim();
  if (name) return name;
  const email = (m.email ?? "").trim();
  if (email) return email;
  return `Gestor ${m.id.slice(0, 8)}`;
}

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ["diretoria", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const requestedCompanyId = (req.nextUrl.searchParams.get("company_id") || "").trim();
  const isAdminLike = guard.role === "admin";
  // Admin pode operar globalmente; diretoria fica no escopo de empresa.
  const scopeCompanyId = isAdminLike ? requestedCompanyId || null : requestedCompanyId || guard.companyId || null;
  const isMissingColumnError = (msg: string) => {
    const m = (msg || "").toLowerCase();
    return m.includes("does not exist") || m.includes("schema cache") || m.includes("column");
  };

  // Clients: tenta schema novo e faz fallback para schema antigo.
  let rawClients: ClientRow[] = [];
  {
    const newer = await supabaseAdmin
      .from("project_clients")
      .select("id,name,company_id,active")
      .order("name", { ascending: true });

    if (!newer.error) {
      rawClients = ((newer.data ?? []) as Array<ClientRow & { active?: boolean | null }>).filter(
        (row) => row.active == null || row.active === true
      );
    } else if (isMissingColumnError(newer.error.message)) {
      const older = await supabaseAdmin.from("project_clients").select("id,name").order("name", { ascending: true });
      if (older.error) return NextResponse.json({ error: older.error.message }, { status: 400 });
      rawClients = (older.data ?? []).map((row) => ({ id: row.id, name: row.name, company_id: null })) as ClientRow[];
    } else {
      return NextResponse.json({ error: newer.error.message }, { status: 400 });
    }
  }

  // Profiles: tenta schema novo e fallback antigo.
  let profileRows: Array<{ id: string; full_name: string | null; role?: string | null; company_id?: string | null; active?: boolean | null }> = [];
  {
    const newer = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,role,company_id,active")
      .order("full_name", { ascending: true });

    if (!newer.error) {
      profileRows = (newer.data ?? []) as Array<{ id: string; full_name: string | null; role?: string | null; company_id?: string | null; active?: boolean | null }>;
    } else if (isMissingColumnError(newer.error.message)) {
      const older = await supabaseAdmin.from("profiles").select("id,full_name,role").order("full_name", { ascending: true });
      if (older.error) return NextResponse.json({ error: older.error.message }, { status: 400 });
      profileRows = (older.data ?? []).map((p) => ({ ...p, company_id: null, active: true })) as Array<
        { id: string; full_name: string | null; role?: string | null; company_id?: string | null; active?: boolean | null }
      >;
    } else {
      return NextResponse.json({ error: newer.error.message }, { status: 400 });
    }
  }

  const cargosRes = await supabaseAdmin.from("cargos").select("name,portal_role");
  const cargos = !cargosRes.error
    ? (cargosRes.data ?? []) as Array<{ name: string; portal_role: string | null }>
    : [] as Array<{ name: string; portal_role: string | null }>;

  const colaboradoresRes = await supabaseAdmin.from("colaboradores").select("user_id,nome,email,cargo");
  if (colaboradoresRes.error) return NextResponse.json({ error: colaboradoresRes.error.message }, { status: 400 });
  const colaboradores = (colaboradoresRes.data ?? []) as Array<{
    user_id: string | null;
    nome: string | null;
    email: string | null;
    cargo: string | null;
  }>;

  const companyProfileIds = new Set(
    profileRows
      .filter((p) => p.active !== false)
      .filter((p) => {
        if (isAdminLike) return true;
        return !scopeCompanyId || !p.company_id || p.company_id === scopeCompanyId;
      })
      .map((p) => p.id)
  );
  const activeProfileIds = new Set(
    profileRows
      .filter((p) => p.active !== false)
      .map((p) => p.id)
  );

  const clientsScoped = rawClients
    .filter((row) => {
      if (isAdminLike) return true;
      if (!scopeCompanyId) return true;
      return row.company_id === scopeCompanyId || row.company_id == null;
    })
    .map((row) => ({ id: row.id, name: row.name }));

  // Fallback: se admin escolher empresa sem dados vinculados, ainda pode ver lista global.
  const clients = isAdminLike && clientsScoped.length === 0
    ? rawClients.map((row) => ({ id: row.id, name: row.name }))
    : clientsScoped;

  const managersByProfile = profileRows.filter((p) => {
    if (p.active === false) return false;
    if (isAdminLike) return true;
    return !scopeCompanyId || !p.company_id || p.company_id === scopeCompanyId;
  });

  const gestorCargoNames = new Set(
    cargos
      .filter((c) => (c.portal_role ?? "").trim().toLowerCase() === "gestor")
      .map((c) => (c.name ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  const managerMap = new Map<string, ManagerRow>();
  for (const m of managersByProfile) {
    if (!m.id) continue;
    managerMap.set(m.id, { id: m.id, full_name: m.full_name ?? null, email: null });
  }

  for (const c of colaboradores) {
    const uid = (c.user_id ?? "").trim();
    if (!uid) continue;
    if (!activeProfileIds.has(uid)) continue;
    if (!isAdminLike && !companyProfileIds.has(uid)) continue;
    const cargoName = (c.cargo ?? "").trim().toLowerCase();
    const prev = managerMap.get(uid);

    // Mantem todos os colaboradores com usuario vinculado visiveis no seletor.
    // Quando cargo mapear para gestor, o nome/correspondencia e priorizado.
    if (cargoName && !gestorCargoNames.has(cargoName) && prev) continue;
    managerMap.set(uid, {
      id: uid,
      full_name: (c.nome ?? "").trim() || prev?.full_name || null,
      email: (c.email ?? "").trim() || prev?.email || null,
    });
  }

  if (isAdminLike && managerMap.size === 0) {
    for (const p of profileRows) {
      if (!p.id || p.active === false) continue;
      managerMap.set(p.id, { id: p.id, full_name: p.full_name ?? null, email: null });
    }
    for (const c of colaboradores) {
      const uid = (c.user_id ?? "").trim();
      if (!uid) continue;
      const prev = managerMap.get(uid);
      managerMap.set(uid, {
        id: uid,
        full_name: (c.nome ?? "").trim() || prev?.full_name || null,
        email: (c.email ?? "").trim() || prev?.email || null,
      });
    }
  }

  // Fallback definitivo: se ainda nao houver gestores, usa todos perfis ativos
  // para impedir tela vazia em bases legadas com vinculos incompletos.
  if (managerMap.size === 0) {
    for (const p of profileRows) {
      if (!p.id || p.active === false) continue;
      managerMap.set(p.id, { id: p.id, full_name: p.full_name ?? null, email: null });
    }
  }

  const managers = Array.from(managerMap.values()).sort((a, b) =>
    managerLabel(a).localeCompare(managerLabel(b), "pt-BR", { sensitivity: "base" })
  );

  return NextResponse.json({
    company_id: scopeCompanyId ?? null,
    clients,
    managers,
  });
}
