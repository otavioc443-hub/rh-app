import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type NotifyAction = "created" | "updated" | "cancelled" | "approved" | "rejected";

type AbsenceRequestNotifyInput = {
  id?: string;
  user_id: string;
  manager_id?: string | null;
  start_date: string;
  end_date: string;
  days_count?: number | null;
  reason?: string | null;
  manager_comment?: string | null;
};

type RuleRow = {
  event_key: string;
  enabled: boolean;
  notify_assigned_user: boolean;
  notify_project_managers: boolean;
  notify_actor: boolean;
  link_default: string | null;
};

function fmtDateBR(raw: string | null | undefined) {
  if (!raw) return "-";
  const s = String(raw).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (y && m && d) return `${d}/${m}/${y}`;
  return String(raw);
}

export async function POST(req: Request) {
  const guard = await requireRoles(["colaborador", "gestor", "rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as {
      action?: NotifyAction;
      requests?: AbsenceRequestNotifyInput[];
    };

    const actionInput = body.action;
    const action: NotifyAction =
      actionInput === "updated" ||
      actionInput === "cancelled" ||
      actionInput === "approved" ||
      actionInput === "rejected"
        ? actionInput
        : "created";
    const requests = Array.isArray(body.requests) ? body.requests : [];
    if (!requests.length) {
      return NextResponse.json({ error: "Nenhuma solicitacao informada." }, { status: 400 });
    }

    const eventKeyMap: Record<NotifyAction, string> = {
      created: "absence_request_created",
      updated: "absence_request_updated",
      cancelled: "absence_request_cancelled",
      approved: "absence_request_approved",
      rejected: "absence_request_rejected",
    };
    const eventKey = eventKeyMap[action];

    let rule: RuleRow | null = null;
    const ruleRes = await supabaseAdmin
      .from("notification_automation_rules")
      .select("event_key,enabled,notify_assigned_user,notify_project_managers,notify_actor,link_default")
      .eq("event_key", eventKey)
      .maybeSingle<RuleRow>();
    if (!ruleRes.error) {
      rule = ruleRes.data ?? null;
    }

    if (rule?.enabled === false) {
      return NextResponse.json({ ok: true, notified: 0, skipped: "event_disabled" });
    }

    const rows: Array<{ to_user_id: string; title: string; body: string; link: string; type: string }> = [];

    for (const r of requests) {
      const requesterId = String(r.user_id ?? "").trim();
      const managerId = String(r.manager_id ?? "").trim();
      if (!requesterId) continue;

      const days = Number(r.days_count ?? 0) || 0;
      const periodText = `${fmtDateBR(r.start_date)} ate ${fmtDateBR(r.end_date)}`;
      const reasonText = (r.reason ?? "").trim();
      const managerComment = (r.manager_comment ?? "").trim();

      let title = "Solicitacao de ausencia";
      let bodyText = `Periodo ${periodText}.`;
      if (action === "created") {
        title = "Solicitacao de ausencia enviada";
        bodyText = `Colaborador enviou solicitacao de ausencia (${days} dia(s)) para ${periodText}.${reasonText ? ` Motivo: ${reasonText}.` : ""}`;
      } else if (action === "updated") {
        title = "Solicitacao de ausencia atualizada";
        bodyText = `Solicitacao de ausencia foi atualizada (${days} dia(s)) para ${periodText}.${reasonText ? ` Motivo: ${reasonText}.` : ""}`;
      } else if (action === "cancelled") {
        title = "Solicitacao de ausencia cancelada";
        bodyText = `Solicitacao de ausencia (${days} dia(s)) para ${periodText} foi cancelada pelo colaborador.`;
      } else if (action === "approved") {
        title = "Solicitacao de ausencia aprovada";
        bodyText = `Sua solicitacao de ausencia (${days} dia(s)) para ${periodText} foi aprovada.${managerComment ? ` Comentario do gestor: ${managerComment}.` : ""}`;
      } else if (action === "rejected") {
        title = "Solicitacao de ausencia recusada";
        bodyText = `Sua solicitacao de ausencia (${days} dia(s)) para ${periodText} foi recusada.${managerComment ? ` Motivo/Comentario do gestor: ${managerComment}.` : ""}`;
      }

      const notifyRequester =
        action === "approved" || action === "rejected"
          ? rule?.notify_assigned_user !== false
          : rule?.notify_actor === true || false;
      const notifyManager =
        action === "created" || action === "updated" || action === "cancelled"
          ? rule?.notify_project_managers !== false
          : rule?.notify_actor === true || false;

      const link = rule?.link_default ??
        (action === "approved" || action === "rejected"
          ? "/meu-perfil/ausencias-programadas"
          : "/gestor/ausencias");

      if (notifyRequester) {
        rows.push({
          to_user_id: requesterId,
          title,
          body: bodyText,
          link: action === "approved" || action === "rejected" ? link : "/meu-perfil/ausencias-programadas",
          type: eventKey,
        });
      }
      if (notifyManager && managerId) {
        rows.push({
          to_user_id: managerId,
          title,
          body: bodyText,
          link: action === "created" || action === "updated" || action === "cancelled" ? link : "/gestor/ausencias",
          type: eventKey,
        });
      }
    }

    const dedup = new Map<string, (typeof rows)[number]>();
    for (const row of rows) dedup.set(`${row.to_user_id}|${row.type}|${row.body}`, row);
    if (!dedup.size) return NextResponse.json({ ok: true, notified: 0, skipped: "no_recipients" });

    const { error } = await supabaseAdmin.from("notifications").insert(Array.from(dedup.values()));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, notified: dedup.size, event_key: eventKey });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado." }, { status: 500 });
  }
}

