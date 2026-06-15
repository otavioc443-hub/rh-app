import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type MarkReadBody = {
  ids?: string[];
  filter?: {
    unreadOnly?: boolean;
    category?: string | null;
    severity?: "info" | "success" | "warning" | "critical" | null;
    actionRequired?: boolean | null;
  };
};

export async function POST(req: Request) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "financeiro", "pd", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as MarkReadBody;
    const now = new Date().toISOString();

    let query = supabaseAdmin
      .from("notifications")
      .update({ read_at: now }, { count: "exact" })
      .eq("to_user_id", access.userId);

    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length) {
      query = query.in("id", ids);
    } else {
      const filter = body.filter ?? {};
      if (filter.unreadOnly !== false) query = query.is("read_at", null);
      if (filter.category && filter.category !== "all") query = query.eq("category", filter.category);
      if (filter.severity && filter.severity !== "info") query = query.eq("severity", filter.severity);
      if (filter.actionRequired === true) query = query.eq("action_required", true);
    }

    const { error, count } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true, updated: count ?? 0, read_at: now });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao marcar notificacoes como lidas." },
      { status: 500 },
    );
  }
}
