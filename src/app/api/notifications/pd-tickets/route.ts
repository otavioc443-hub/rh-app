import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { insertNotifications, notifyRoles } from "@/lib/server/notifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TicketAction = "created" | "updated";

export async function POST(req: Request) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "financeiro", "pd", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as { ticket_id?: string; action?: TicketAction };
    const ticketId = String(body.ticket_id ?? "").trim();
    const action = body.action === "updated" ? "updated" : "created";
    if (!ticketId) return NextResponse.json({ error: "ticket_id obrigatorio." }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("pd_tickets")
      .select("id,requester_user_id,title,status,resolution_notes")
      .eq("id", ticketId)
      .maybeSingle<{ id: string; requester_user_id: string; title: string; status: string; resolution_notes: string | null }>();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Chamado nao encontrado." }, { status: 404 });

    if (action === "created") {
      const result = await notifyRoles(
        ["pd", "admin"],
        {
          title: "Novo chamado P&D",
          body: data.title,
          link: "/p-d/chamados",
          type: "pd_ticket_created",
          entity_type: "pd_ticket",
          entity_id: data.id,
          action_required: true,
        },
        { companyId: access.companyId, excludeUserIds: [access.userId] },
      );
      return NextResponse.json({ ok: true, notified: result.inserted });
    }

    const result = await insertNotifications([
      {
        to_user_id: data.requester_user_id,
        title: "Chamado P&D atualizado",
        body: data.resolution_notes ? `Status: ${data.status}. Retorno: ${data.resolution_notes}` : `Status atualizado para ${data.status}.`,
        link: "/meu-perfil/chamados",
        type: "pd_ticket_updated",
        entity_type: "pd_ticket",
        entity_id: data.id,
      },
    ]);
    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao notificar chamado P&D." },
      { status: 500 },
    );
  }
}
