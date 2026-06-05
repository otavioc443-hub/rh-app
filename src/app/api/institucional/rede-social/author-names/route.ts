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
  id?: string | null;
  user_id: string | null;
  nome: string | null;
  email: string | null;
  email_empresarial?: string | null;
  email_pessoal?: string | null;
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

function cleanEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
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
      supabaseAdmin
        .from("colaboradores")
        .select("id,user_id,nome,email,email_empresarial,email_pessoal")
        .or(`user_id.in.(${userIds.join(",")}),id.in.(${userIds.join(",")})`),
    ]);

    if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });
    if (collaboratorsRes.error) return NextResponse.json({ error: collaboratorsRes.error.message }, { status: 400 });

    const names: Record<string, string> = {};
    const profiles = (profilesRes.data ?? []) as ProfileRow[];
    for (const row of (collaboratorsRes.data ?? []) as CollaboratorRow[]) {
      const name = cleanName(row.nome);
      if (!name) continue;
      if (row.user_id) names[row.user_id] = name;
      if (row.id) names[row.id] = name;
    }

    const unresolvedProfileEmails = profiles
      .filter((row) => !names[row.id])
      .map((row) => cleanEmail(row.email))
      .filter(Boolean);
    if (unresolvedProfileEmails.length) {
      const emailCollaboratorsRes = await supabaseAdmin
        .from("colaboradores")
        .select("user_id,nome,email,email_empresarial,email_pessoal")
        .or(
          [
            `email.in.(${unresolvedProfileEmails.join(",")})`,
            `email_empresarial.in.(${unresolvedProfileEmails.join(",")})`,
            `email_pessoal.in.(${unresolvedProfileEmails.join(",")})`,
          ].join(",")
        );

      if (!emailCollaboratorsRes.error) {
        const collaboratorByEmail = new Map<string, string>();
        for (const collaborator of (emailCollaboratorsRes.data ?? []) as CollaboratorRow[]) {
          const name = cleanName(collaborator.nome);
          if (!name) continue;
          for (const email of [collaborator.email, collaborator.email_empresarial, collaborator.email_pessoal]) {
            const normalizedEmail = cleanEmail(email);
            if (normalizedEmail) collaboratorByEmail.set(normalizedEmail, name);
          }
        }
        for (const profile of profiles) {
          const name = collaboratorByEmail.get(cleanEmail(profile.email));
          if (name) names[profile.id] = name;
        }
      }
    }

    for (const row of profiles) {
      const profileName = cleanName(row.full_name);
      if (profileName && !names[row.id]) names[row.id] = profileName;
    }

    const unresolvedUserIds = userIds.filter((id) => !names[id]);
    if (unresolvedUserIds.length) {
      const authUsers = await Promise.all(
        unresolvedUserIds.map(async (id) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id).catch(() => ({ data: null }));
          return data?.user ?? null;
        })
      );
      for (const authUser of authUsers) {
        if (!authUser?.id || names[authUser.id]) continue;
        const metadata = authUser.user_metadata as Record<string, unknown> | null;
        const metadataName = cleanName(
          String(metadata?.full_name ?? metadata?.name ?? metadata?.nome ?? metadata?.display_name ?? "")
        );
        if (metadataName) {
          names[authUser.id] = metadataName;
          continue;
        }
        const email = cleanEmail(authUser.email);
        if (email) names[authUser.id] = email;
      }
    }

    return NextResponse.json({ ok: true, names });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
