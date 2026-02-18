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

export async function POST(req: Request) {
  try {
    const requester = await getRequesterRole(req);
    if (!requester.userId) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });
    if (requester.role !== "admin" && requester.role !== "financeiro") {
      return NextResponse.json({ error: "Sem permissao para executar worker." }, { status: 403 });
    }

    const workerId = `manual:${requester.userId}`;
    const result = await processNextInvoiceJob(workerId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
