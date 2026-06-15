import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { insertNotifications, notifyRoles } from "@/lib/server/notifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PaymentStatus = "pending" | "approved" | "rejected" | "paid";

function statusLabel(status: PaymentStatus) {
  if (status === "approved") return "aprovado";
  if (status === "rejected") return "recusado";
  if (status === "paid") return "pago";
  return "pendente";
}

export async function POST(req: Request) {
  const access = await requireRoles(["gestor", "coordenador", "financeiro", "rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as { payment_id?: string; action?: "created" | PaymentStatus; note?: string | null };
    const paymentId = String(body.payment_id ?? "").trim();
    if (!paymentId) return NextResponse.json({ error: "payment_id obrigatorio." }, { status: 400 });

    const { data: payment, error } = await supabaseAdmin
      .from("project_extra_payments")
      .select("id,user_id,amount,reference_month,status,description")
      .eq("id", paymentId)
      .maybeSingle<{ id: string; user_id: string; amount: number | null; reference_month: string | null; status: PaymentStatus; description: string | null }>();
    if (error) throw error;
    if (!payment) return NextResponse.json({ error: "Pagamento extra nao encontrado." }, { status: 404 });

    const action = body.action ?? payment.status;
    const note = String(body.note ?? "").trim();

    if (action === "created" || action === "pending") {
      const result = await notifyRoles(
        ["financeiro", "admin"],
        {
          title: "Novo pagamento extra pendente",
          body: payment.description?.trim() || "Pagamento extra enviado para analise financeira.",
          link: "/financeiro/pagamentos-extras",
          type: "extra_payment_created",
        },
        { companyId: access.companyId, excludeUserIds: [access.userId] },
      );
      return NextResponse.json({ ok: true, notified: result.inserted });
    }

    const result = await insertNotifications([
      {
        to_user_id: payment.user_id,
        title: `Pagamento extra ${statusLabel(action)}`,
        body: note ? `Seu pagamento extra foi ${statusLabel(action)}. Observacao: ${note}` : `Seu pagamento extra foi ${statusLabel(action)}.`,
        link: "/meu-perfil/projetos",
        type: `extra_payment_${action}`,
      },
    ]);

    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao notificar pagamento extra." },
      { status: 500 },
    );
  }
}
