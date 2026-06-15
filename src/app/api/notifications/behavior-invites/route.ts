import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { insertNotifications } from "@/lib/server/notifications";

export async function POST(req: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as { user_ids?: string[]; release_ids?: string[] };
    const userIds = Array.from(new Set((Array.isArray(body.user_ids) ? body.user_ids : []).filter(Boolean)));
    const releaseIds = Array.isArray(body.release_ids) ? body.release_ids : [];
    const result = await insertNotifications(
      userIds.map((userId, index) => ({
        to_user_id: userId,
        title: "Mapa comportamental liberado",
        body: "Voce recebeu uma liberacao para responder o mapa comportamental.",
        link: "/meu-perfil/mapa-comportamental",
        type: "behavior_invite",
        entity_type: "behavior_assessment_release",
        entity_id: releaseIds[index] ?? userId,
        action_required: true,
      })),
    );
    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao notificar mapa comportamental." },
      { status: 500 },
    );
  }
}
