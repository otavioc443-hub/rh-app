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

function simulatedBoleto(remittanceId: string, totalAmount: number) {
  const clean = remittanceId.replace(/-/g, "").slice(0, 20);
  const barcode = `00190.00009 01234.567890 ${clean.slice(0, 10)} 1 ${Math.round(totalAmount * 100)}`;
  const digitable = barcode.replace(/\s+/g, "");
  const url = `https://boleto.local/remessa/${remittanceId}`;
  return { barcode, digitable, url, providerReference: `SIM-${clean}` };
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

    const remRes = await supabaseAdmin
      .from("collaborator_invoice_remittances")
      .select("id,total_amount,code,status,due_date")
      .eq("id", remittanceId)
      .maybeSingle<{ id: string; total_amount: number; code: string; status: string; due_date: string | null }>();
    if (remRes.error || !remRes.data) return NextResponse.json({ error: "Remessa nao encontrada" }, { status: 404 });
    const remittance = remRes.data;

    const itemsRes = await supabaseAdmin
      .from("collaborator_invoice_remittance_items")
      .select("id")
      .eq("remittance_id", remittanceId)
      .limit(1);
    if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 400 });
    if (!(itemsRes.data ?? []).length) return NextResponse.json({ error: "Remessa sem notas vinculadas." }, { status: 400 });

    const apiUrl = process.env.BOLETO_PROVIDER_API_URL?.trim() ?? "";
    const apiToken = process.env.BOLETO_PROVIDER_API_TOKEN?.trim() ?? "";

    let boletoUrl = "";
    let barcode = "";
    let digitable = "";
    let providerReference = "";

    if (apiUrl && apiToken) {
      const providerRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          remittance_id: remittance.id,
          remittance_code: remittance.code,
          amount: remittance.total_amount,
          due_date: remittance.due_date,
        }),
      });
      const providerJson = (await providerRes.json().catch(() => ({}))) as {
        boleto_url?: string;
        barcode?: string;
        digitable_line?: string;
        reference?: string;
        error?: string;
      };
      if (!providerRes.ok) {
        return NextResponse.json({ error: providerJson.error || `Falha no provedor de boleto (${providerRes.status})` }, { status: 400 });
      }
      boletoUrl = providerJson.boleto_url ?? "";
      barcode = providerJson.barcode ?? "";
      digitable = providerJson.digitable_line ?? "";
      providerReference = providerJson.reference ?? "";
    } else {
      const sim = simulatedBoleto(remittance.id, Number(remittance.total_amount ?? 0));
      boletoUrl = sim.url;
      barcode = sim.barcode;
      digitable = sim.digitable;
      providerReference = sim.providerReference;
    }

    const updRes = await supabaseAdmin
      .from("collaborator_invoice_remittances")
      .update({
        status: "payment_pending",
        payment_method: "boleto",
        boleto_url: boletoUrl || null,
        boleto_barcode: barcode || null,
        boleto_digitable_line: digitable || null,
        provider_reference: providerReference || null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", remittance.id);
    if (updRes.error) return NextResponse.json({ error: updRes.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, boleto_url: boletoUrl, barcode, digitable_line: digitable });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
