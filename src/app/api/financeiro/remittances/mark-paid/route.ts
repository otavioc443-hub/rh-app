import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "admin" | "rh" | "financeiro" | "gestor" | "coordenador" | "colaborador" | "pd";

async function getRequester(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { userId: null as string | null, role: null as Role | null, status: 401 as const };

  const userRes = await supabaseAdmin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) return { userId: null as string | null, role: null as Role | null, status: 401 as const };
  const userId = userRes.data.user.id;
  const roleRes = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle<{ role: Role }>();
  return { userId, role: roleRes.data?.role ?? null, status: 200 as const };
}

export async function POST(req: Request) {
  try {
    const requester = await getRequester(req);
    if (!requester.userId) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });
    if (requester.role !== "admin" && requester.role !== "financeiro" && requester.role !== "rh") {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { remittance_id?: string };
    const remittanceId = String(body.remittance_id ?? "").trim();
    if (!remittanceId) return NextResponse.json({ error: "remittance_id e obrigatorio" }, { status: 400 });

    const updRes = await supabaseAdmin
      .from("collaborator_invoice_remittances")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", remittanceId);
    if (updRes.error) return NextResponse.json({ error: updRes.error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
