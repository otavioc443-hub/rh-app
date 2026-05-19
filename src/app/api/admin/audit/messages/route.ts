import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  company_id: string | null;
};

type MessageRow = {
  id: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  text: string;
  created_at: string;
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

function displayName(profile?: ProfileRow | null) {
  const full = (profile?.full_name ?? "").trim();
  if (full && !full.includes("@")) return full;
  return (profile?.email ?? "Colaborador").trim() || "Colaborador";
}

function parseLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(Math.floor(parsed), 500);
}

export async function GET(req: NextRequest) {
  try {
    const supabaseServer = await getServerSupabase();
    const { data: userRes } = await supabaseServer.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const { data: requester, error: requesterErr } = await supabaseAdmin
      .from("profiles")
      .select("role,active")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null; active: boolean | null }>();

    if (requesterErr || requester?.active !== true || requester.role !== "admin") {
      return NextResponse.json({ error: "Apenas admin pode auditar mensagens." }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const senderId = (params.get("senderId") ?? "").trim();
    const receiverId = (params.get("receiverId") ?? "").trim();
    const limit = parseLimit(params.get("limit"));

    const { data: profilesData, error: profilesErr } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email,role,company_id")
      .eq("active", true)
      .order("full_name", { ascending: true });
    if (profilesErr) return NextResponse.json({ error: profilesErr.message }, { status: 400 });

    const profiles = (profilesData ?? []) as ProfileRow[];
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const people = profiles.map((profile) => ({
      id: profile.id,
      name: displayName(profile),
      email: profile.email,
      role: profile.role,
      company_id: profile.company_id,
    }));

    if (!senderId || !receiverId) {
      return NextResponse.json({ ok: true, people, messages: [] });
    }
    if (senderId === receiverId) {
      return NextResponse.json({ ok: true, people, messages: [] });
    }

    const { data: messagesData, error: messagesErr } = await supabaseAdmin
      .from("internal_social_direct_messages")
      .select("id,from_user_id,from_name,to_user_id,text,created_at")
      .or(
        `and(from_user_id.eq.${senderId},to_user_id.eq.${receiverId}),and(from_user_id.eq.${receiverId},to_user_id.eq.${senderId})`
      )
      .order("created_at", { ascending: true })
      .limit(limit);

    if (messagesErr) return NextResponse.json({ error: messagesErr.message }, { status: 400 });

    const messages = ((messagesData ?? []) as MessageRow[]).map((message) => {
      const from = profileById.get(message.from_user_id);
      const to = profileById.get(message.to_user_id);
      return {
        id: message.id,
        from_user_id: message.from_user_id,
        from_name: displayName(from) || message.from_name,
        to_user_id: message.to_user_id,
        to_name: displayName(to),
        text: message.text,
        created_at: message.created_at,
      };
    });

    return NextResponse.json({ ok: true, people, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
