import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IntegrationProvider = "sougov" | "portal_estadual" | "portal_municipal" | "custom";

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
    if (error || !data?.user) return { user: null, status: 401 as const, token: null };
    return { user: data.user, status: 200 as const, token };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const), token: null };
}

async function getRequesterSupabase(req: Request, token: string | null): Promise<SupabaseClient> {
  if (token) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

function parseProvider(value: unknown): IntegrationProvider | null {
  if (value === "sougov" || value === "portal_estadual" || value === "portal_municipal" || value === "custom") {
    return value;
  }
  return null;
}

function getCryptoKey() {
  const raw = (process.env.INVOICE_CREDENTIALS_ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("INVOICE_CREDENTIALS_ENCRYPTION_KEY nao configurada.");
  return createHash("sha256").update(raw, "utf8").digest();
}

function encryptSecret(secret: string) {
  const key = getCryptoKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    secret_ciphertext: encrypted.toString("base64"),
    secret_iv: iv.toString("base64"),
    secret_tag: tag.toString("base64"),
  };
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    if (!requester.user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const body = (await req.json().catch(() => ({}))) as { provider?: unknown; password?: unknown };
    const provider = parseProvider(body.provider);
    const password = String(body.password ?? "");

    if (!provider) return NextResponse.json({ error: "provider invalido" }, { status: 400 });
    if (!password.trim()) return NextResponse.json({ error: "password e obrigatorio" }, { status: 400 });
    if (password.length > 300) return NextResponse.json({ error: "password excede o limite" }, { status: 400 });

    const encrypted = encryptSecret(password.trim());
    const supabaseUser = await getRequesterSupabase(req, requester.token);

    const { error } = await supabaseAdmin
      .from("collaborator_invoice_integration_secrets")
      .upsert(
        {
          user_id: requester.user.id,
          provider,
          ...encrypted,
          key_version: 1,
          updated_by: requester.user.id,
        },
        { onConflict: "user_id,provider" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const profileUpdateRes = await supabaseUser
      .from("collaborator_invoice_integration_profiles")
      .update({ nfs_password_set: true, preferred_provider: provider })
      .eq("user_id", requester.user.id);
    if (profileUpdateRes.error) return NextResponse.json({ error: profileUpdateRes.error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
