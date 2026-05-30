import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET_PATH_MARKERS = [
  "/storage/v1/object/sign/internal-social-media/",
  "/storage/v1/object/public/internal-social-media/",
];

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
    if (error || !data?.user) return null;
    return data.user;
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return data?.user ?? null;
}

function isAllowedStorageUrl(value: string) {
  try {
    const targetUrl = new URL(value);
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (targetUrl.hostname !== supabaseUrl.hostname) return false;
    return BUCKET_PATH_MARKERS.some((marker) => targetUrl.pathname.includes(marker));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,active")
      .eq("id", user.id)
      .maybeSingle<{ id: string; active: boolean | null }>();

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
    if (!profile?.id || profile.active !== true) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    const requestUrl = new URL(req.url);
    const target = requestUrl.searchParams.get("url") ?? "";
    if (!target || !isAllowedStorageUrl(target)) {
      return NextResponse.json({ error: "URL de PDF invalida" }, { status: 400 });
    }

    const response = await fetch(target, { cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "PDF indisponivel" }, { status: response.status });

    const contentType = response.headers.get("content-type") || "application/pdf";
    if (!contentType.toLowerCase().includes("pdf")) {
      return NextResponse.json({ error: "Arquivo nao e PDF" }, { status: 400 });
    }

    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
