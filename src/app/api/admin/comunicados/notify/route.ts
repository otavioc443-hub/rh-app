import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { getBroadcastProfileIds, insertNotifications } from "@/lib/server/notifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AnnouncementRow = {
  id: string;
  company_id: string | null;
  title: string;
  body: string;
  cta_href: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

function isCurrentlyVisible(row: AnnouncementRow) {
  if (!row.active) return false;
  const now = Date.now();
  const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null;
  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;
  if (startsAt && Number.isFinite(startsAt) && startsAt > now) return false;
  if (endsAt && Number.isFinite(endsAt) && endsAt < now) return false;
  return true;
}

export async function POST(req: Request) {
  const access = await requireRoles(["admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as { announcement_id?: string; mode?: "created" | "updated" };
    const id = String(body.announcement_id ?? "").trim();
    if (!id) return NextResponse.json({ error: "announcement_id obrigatorio." }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("pulsehub_home_announcements")
      .select("id,company_id,title,body,cta_href,active,starts_at,ends_at")
      .eq("id", id)
      .maybeSingle<AnnouncementRow>();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Comunicado nao encontrado." }, { status: 404 });
    if (!isCurrentlyVisible(data)) return NextResponse.json({ ok: true, notified: 0, skipped: "not_visible" });

    const recipients = await getBroadcastProfileIds(data.company_id, [access.userId]);
    const title = body.mode === "updated" ? `Comunicado atualizado: ${data.title}` : `Novo comunicado: ${data.title}`;
    const result = await insertNotifications(
      recipients.map((userId) => ({
        to_user_id: userId,
        title,
        body: data.body,
        link: data.cta_href || "/home",
        type: "home_announcement",
      })),
    );

    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao notificar comunicado." },
      { status: 500 },
    );
  }
}
