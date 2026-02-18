import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processNextInvoiceJob } from "@/lib/invoices/automation";

type Role = "admin" | "rh" | "financeiro" | "gestor" | "coordenador" | "colaborador" | "p_d";

async function getRequesterRole(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { role: null as Role | null, userId: null as string | null, status: 401 as const };

  const userRes = await supabaseAdmin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) return { role: null as Role | null, userId: null as string | null, status: 401 as const };

  const userId = userRes.data.user.id;
  const roleRes = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle<{ role: Role }>();
  return { role: roleRes.data?.role ?? null, userId, status: 200 as const };
}

function parseLimit(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(50, Math.trunc(n)));
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterRole(req);
    if (!requester.userId) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });
    if (requester.role !== "admin" && requester.role !== "financeiro") {
      return NextResponse.json({ error: "Sem permissao para executar worker." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { limit?: unknown };
    const limit = parseLimit(body.limit);
    const workerId = `batch:${requester.userId}`;
    const results: Array<unknown> = [];

    for (let i = 0; i < limit; i += 1) {
      const result = await processNextInvoiceJob(workerId);
      if (!result.processed) break;
      results.push(result);
    }

    return NextResponse.json({
      ok: true,
      requested_limit: limit,
      processed_count: results.length,
      results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
