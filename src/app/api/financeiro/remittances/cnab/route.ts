import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "admin" | "rh" | "financeiro" | "gestor" | "coordenador" | "colaborador" | "pd";

async function getRequester(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { role: null as Role | null, status: 401 as const };

  const userRes = await supabaseAdmin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) return { role: null as Role | null, status: 401 as const };
  const roleRes = await supabaseAdmin.from("profiles").select("role").eq("id", userRes.data.user.id).maybeSingle<{ role: Role }>();
  return { role: roleRes.data?.role ?? null, status: 200 as const };
}

export async function GET(req: Request) {
  try {
    const requester = await getRequester(req);
    if (requester.status !== 200) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });
    if (requester.role !== "admin" && requester.role !== "financeiro" && requester.role !== "rh") {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const url = new URL(req.url);
    const remittanceId = url.searchParams.get("remittance_id")?.trim() ?? "";
    if (!remittanceId) return NextResponse.json({ error: "remittance_id e obrigatorio" }, { status: 400 });

    const remRes = await supabaseAdmin
      .from("collaborator_invoice_remittances")
      .select("id,code,total_amount,due_date,status")
      .eq("id", remittanceId)
      .maybeSingle<{ id: string; code: string; total_amount: number; due_date: string | null; status: string }>();
    if (remRes.error || !remRes.data) return NextResponse.json({ error: "Remessa nao encontrada" }, { status: 404 });

    const itemsRes = await supabaseAdmin
      .from("collaborator_invoice_remittance_items")
      .select("invoice_id,amount,invoice_number,user_id")
      .eq("remittance_id", remittanceId)
      .order("created_at", { ascending: true });
    if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 400 });

    const lines: string[] = [];
    lines.push(`0|BRADESCO|REMESSA|${remRes.data.code}|${remRes.data.due_date ?? ""}|${Number(remRes.data.total_amount).toFixed(2)}`);
    for (const item of itemsRes.data ?? []) {
      lines.push(
        `1|${item.user_id}|${item.invoice_id}|${item.invoice_number ?? ""}|${Number(item.amount ?? 0).toFixed(2)}`
      );
    }
    lines.push(`9|TOTAL|${(itemsRes.data ?? []).length}|${Number(remRes.data.total_amount).toFixed(2)}`);

    const filename = `CNAB_${remRes.data.code}.txt`;
    return new NextResponse(lines.join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
