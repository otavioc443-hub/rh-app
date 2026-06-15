import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { insertNotifications, notifyRoles } from "@/lib/server/notifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type InvoiceStatus = "submitted" | "approved" | "rejected" | "cancelled";

function statusLabel(status: InvoiceStatus) {
  if (status === "submitted") return "enviada";
  if (status === "approved") return "aprovada";
  if (status === "rejected") return "recusada";
  return "cancelada";
}

export async function POST(req: Request) {
  const access = await requireRoles(["colaborador", "gestor", "financeiro", "rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as { invoice_id?: string; action?: InvoiceStatus; note?: string | null };
    const invoiceId = String(body.invoice_id ?? "").trim();
    const action = body.action;
    if (!invoiceId) return NextResponse.json({ error: "invoice_id obrigatorio." }, { status: 400 });
    if (action !== "submitted" && action !== "approved" && action !== "rejected" && action !== "cancelled") {
      return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
    }

    const { data: invoice, error } = await supabaseAdmin
      .from("collaborator_invoices")
      .select("id,user_id,reference_month,invoice_number,gross_amount")
      .eq("id", invoiceId)
      .maybeSingle<{ id: string; user_id: string; reference_month: string | null; invoice_number: string | null; gross_amount: number | null }>();
    if (error) throw error;
    if (!invoice) return NextResponse.json({ error: "Nota nao encontrada." }, { status: 404 });

    const note = String(body.note ?? "").trim();
    if (action === "submitted") {
      const result = await notifyRoles(
        ["financeiro", "admin"],
        {
          title: "Nova nota fiscal enviada",
          body: `Nota ${invoice.invoice_number ?? invoice.id.slice(0, 8)} foi enviada para analise.`,
          link: "/financeiro/notas-fiscais",
          type: "invoice_submitted",
        },
        { companyId: access.companyId, excludeUserIds: [access.userId] },
      );
      return NextResponse.json({ ok: true, notified: result.inserted });
    }

    const result = await insertNotifications([
      {
        to_user_id: invoice.user_id,
        title: `Nota fiscal ${statusLabel(action)}`,
        body: note ? `Sua nota foi ${statusLabel(action)}. Observacao: ${note}` : `Sua nota fiscal foi ${statusLabel(action)}.`,
        link: "/meu-perfil/nota-fiscal",
        type: `invoice_${action}`,
      },
    ]);

    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao notificar nota fiscal." },
      { status: 500 },
    );
  }
}
