import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  active: boolean | null;
};

type CollaboratorRow = {
  user_id: string | null;
  nome: string | null;
  email: string | null;
};

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

function cleanName(value: string | null | undefined) {
  const name = (value ?? "").trim();
  if (!name || name.includes("@")) return "";
  return name;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const requester = token
      ? await supabaseAdmin.auth.getUser(token)
      : await (await getServerSupabase()).auth.getUser();
    const user = requester.data?.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const { data: requesterProfile, error: requesterErr } = await supabaseAdmin
      .from("profiles")
      .select("id,active")
      .eq("id", user.id)
      .maybeSingle<{ id: string; active: boolean | null }>();
    if (requesterErr || requesterProfile?.active !== true) {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { userIds?: unknown[] } | null;
    const userIds = Array.from(
      new Set(
        (body?.userIds ?? [])
          .map((item) => String(item ?? "").trim())
          .filter((item) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item))
      )
    ).slice(0, 200);

    if (!userIds.length) return NextResponse.json({ ok: true, names: {} });

    const [profilesRes, collaboratorsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name,email,active").in("id", userIds),
      supabaseAdmin.from("colaboradores").select("user_id,nome,email").in("user_id", userIds),
    ]);

    if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });
    if (collaboratorsRes.error) return NextResponse.json({ error: collaboratorsRes.error.message }, { status: 400 });

    const names: Record<string, string> = {};
    for (const row of (collaboratorsRes.data ?? []) as CollaboratorRow[]) {
      const name = cleanName(row.nome);
      if (row.user_id && name) names[row.user_id] = name;
    }

    for (const row of (profilesRes.data ?? []) as ProfileRow[]) {
      const profileName = cleanName(row.full_name);
      if (profileName && !names[row.id]) names[row.id] = profileName;
    }

    return NextResponse.json({ ok: true, names });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
