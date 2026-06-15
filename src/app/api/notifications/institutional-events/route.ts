import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { getBroadcastProfileIds, insertNotifications } from "@/lib/server/notifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as { event_id?: string };
    const eventId = String(body.event_id ?? "").trim();
    if (!eventId) return NextResponse.json({ error: "event_id obrigatorio." }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("institutional_events")
      .select("id,title,description,event_date")
      .eq("id", eventId)
      .maybeSingle<{ id: string; title: string; description: string | null; event_date: string }>();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Evento nao encontrado." }, { status: 404 });

    const recipients = await getBroadcastProfileIds(access.companyId, [access.userId]);
    const result = await insertNotifications(
      recipients.map((userId) => ({
        to_user_id: userId,
        title: `Novo evento institucional: ${data.title}`,
        body: data.description?.trim() || `Data: ${data.event_date}`,
        link: "/agenda/agenda-institucional",
        type: "institutional_event_created",
        entity_type: "institutional_event",
        entity_id: data.id,
      })),
    );

    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao notificar evento institucional." },
      { status: 500 },
    );
  }
}
