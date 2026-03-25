import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "internal-social-media";

type MediaRequestItem = {
  kind: "post" | "message";
  ownerId: string;
  path: string;
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

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, status: 401 as const, token };
    return { user: data.user, status: 200 as const, token };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const), token };
}

async function getRequesterSupabase(token: string | null): Promise<SupabaseClient> {
  if (token) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    if (!requester.user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const supabaseUser = await getRequesterSupabase(requester.token);
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("id,active")
      .eq("id", requester.user.id)
      .maybeSingle<{ id: string; active: boolean | null }>();
    if (!profile?.id || profile.active !== true) {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { items?: MediaRequestItem[] } | null;
    const items = (body?.items ?? [])
      .map((item) => ({
        kind: (item?.kind === "message" ? "message" : "post") as "message" | "post",
        ownerId: String(item?.ownerId ?? "").trim(),
        path: String(item?.path ?? "").trim(),
      }))
      .filter((item) => item.ownerId && item.path)
      .slice(0, 50);

    if (!items.length) {
      return NextResponse.json({ error: "Nenhuma midia solicitada" }, { status: 400 });
    }

    const postIds = Array.from(new Set(items.filter((item) => item.kind === "post").map((item) => item.ownerId)));
    const messageIds = Array.from(new Set(items.filter((item) => item.kind === "message").map((item) => item.ownerId)));

    const [visiblePostsRes, visibleMessagesRes] = await Promise.all([
      postIds.length
        ? supabaseUser.from("internal_social_posts").select("id").in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      messageIds.length
        ? supabaseUser.from("internal_social_direct_messages").select("id").in("id", messageIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (visiblePostsRes.error) {
      return NextResponse.json({ error: visiblePostsRes.error.message }, { status: 400 });
    }
    if (visibleMessagesRes.error) {
      return NextResponse.json({ error: visibleMessagesRes.error.message }, { status: 400 });
    }

    const visiblePostIds = new Set(((visiblePostsRes.data ?? []) as Array<{ id: string }>).map((item) => item.id));
    const visibleMessageIds = new Set(((visibleMessagesRes.data ?? []) as Array<{ id: string }>).map((item) => item.id));
    const allowedItems = items.filter((item) => {
      if (item.kind === "post") return visiblePostIds.has(item.ownerId);
      return visibleMessageIds.has(item.ownerId);
    });

    const signedEntries = await Promise.all(
      allowedItems.map(async (item) => {
        const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(item.path, 60 * 60 * 12);
        if (signed.error || !signed.data?.signedUrl) return null;
        return { kind: item.kind, ownerId: item.ownerId, path: item.path, signedUrl: signed.data.signedUrl };
      }),
    );

    const response = NextResponse.json({ ok: true, items: signedEntries.filter(Boolean) });
    response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=3600");
    return response;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
