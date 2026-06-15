import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { insertNotifications, notifyRoles } from "@/lib/server/notifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LgpdAction = "created" | "updated";

export async function POST(req: Request) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "financeiro", "pd", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as { request_id?: string; action?: LgpdAction };
    const requestId = String(body.request_id ?? "").trim();
    const action = body.action === "updated" ? "updated" : "created";
    if (!requestId) return NextResponse.json({ error: "request_id obrigatorio." }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("lgpd_requests")
      .select("id,requester_user_id,title,status,review_notes")
      .eq("id", requestId)
      .maybeSingle<{ id: string; requester_user_id: string; title: string; status: string; review_notes: string | null }>();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Solicitacao LGPD nao encontrada." }, { status: 404 });

    if (action === "created") {
      const result = await notifyRoles(
        ["rh", "admin", "compliance"],
        {
          title: "Nova solicitacao LGPD",
          body: data.title,
          link: "/rh/lgpd",
          type: "lgpd_request_created",
          entity_type: "lgpd_request",
          entity_id: data.id,
          severity: "warning",
          action_required: true,
        },
        { companyId: access.companyId, excludeUserIds: [access.userId] },
      );
      return NextResponse.json({ ok: true, notified: result.inserted });
    }

    const result = await insertNotifications([
      {
        to_user_id: data.requester_user_id,
        title: "Solicitacao LGPD atualizada",
        body: data.review_notes ? `Status: ${data.status}. Retorno: ${data.review_notes}` : `Status atualizado para ${data.status}.`,
        link: "/institucional/privacidade",
        type: "lgpd_request_updated",
        entity_type: "lgpd_request",
        entity_id: data.id,
      },
    ]);
    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao notificar LGPD." },
      { status: 500 },
    );
  }
}
