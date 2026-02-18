import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enqueueInvoiceIssueJob } from "@/lib/invoices/automation";

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

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    if (!requester.user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const body = (await req.json().catch(() => ({}))) as { invoice_id?: string };
    const invoiceId = String(body.invoice_id ?? "").trim();
    if (!invoiceId) return NextResponse.json({ error: "invoice_id e obrigatorio" }, { status: 400 });

    const supabaseUser = await getRequesterSupabase(req, requester.token);
    const invoiceRes = await supabaseUser
      .from("collaborator_invoices")
      .select("id,user_id,integration_provider")
      .eq("id", invoiceId)
      .maybeSingle<{ id: string; user_id: string; integration_provider: IntegrationProvider }>();
    if (invoiceRes.error || !invoiceRes.data) return NextResponse.json({ error: "Nota fiscal nao encontrada" }, { status: 404 });

    const jobId = await enqueueInvoiceIssueJob(invoiceRes.data.id, invoiceRes.data.user_id, invoiceRes.data.integration_provider);
    return NextResponse.json({ ok: true, job_id: jobId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
