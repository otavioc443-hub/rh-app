import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type AllowanceNotifyInput = {
  user_id: string;
  valid_from?: string | null;
  valid_to?: string | null;
  max_days?: number | null;
  window_start?: string | null;
  window_end?: string | null;
  days_allowed?: number | null;
};

type NotifyAction = "created" | "updated" | "deleted" | "deactivated";

type NotificationAutomationRuleRow = {
  event_key: string;
  enabled: boolean;
  notify_assigned_user: boolean;
  link_default: string | null;
};

function fmtDateBR(dateLike: string | null | undefined) {
  if (!dateLike) return "-";
  const d = new Date(String(dateLike));
  if (Number.isNaN(d.getTime())) {
    const raw = String(dateLike).slice(0, 10);
    const [y, m, day] = raw.split("-");
    if (y && m && day) return `${day}/${m}/${y}`;
    return String(dateLike);
  }
  return d.toLocaleDateString("pt-BR");
}

export async function POST(req: Request) {
  const guard = await requireRoles(["rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as { allowances?: AllowanceNotifyInput[]; action?: NotifyAction };
    const allowances = Array.isArray(body.allowances) ? body.allowances : [];
    const actionInput = body.action;
    const action: NotifyAction =
      actionInput === "updated" || actionInput === "deleted" || actionInput === "deactivated"
        ? actionInput
        : "created";
    if (!allowances.length) {
      return NextResponse.json({ error: "Nenhuma liberacao informada." }, { status: 400 });
    }

    const eventKey =
      action === "updated"
        ? "absence_allowance_updated"
        : action === "deleted"
          ? "absence_allowance_deleted"
          : action === "deactivated"
            ? "absence_allowance_deactivated"
            : "absence_allowance_created";

    let rule: NotificationAutomationRuleRow | null = null;
    const ruleRes = await supabaseAdmin
      .from("notification_automation_rules")
      .select("event_key,enabled,notify_assigned_user,link_default")
      .eq("event_key", eventKey)
      .maybeSingle<NotificationAutomationRuleRow>();
    if (!ruleRes.error) {
      rule = ruleRes.data ?? null;
    } else {
      const msg = ruleRes.error.message.toLowerCase();
      const ignorable =
        msg.includes("relation") ||
        msg.includes("does not exist") ||
        msg.includes("schema cache") ||
        msg.includes("column");
      if (!ignorable) return NextResponse.json({ error: ruleRes.error.message }, { status: 400 });
    }

    if (rule && rule.enabled === false) {
      return NextResponse.json({ ok: true, notified: 0, skipped: "event_disabled" });
    }
    if (rule && rule.notify_assigned_user === false) {
      return NextResponse.json({ ok: true, notified: 0, skipped: "recipient_disabled" });
    }

    const rows = allowances
      .map((a) => {
        const userId = String(a.user_id ?? "").trim();
        if (!userId) return null;
        const start = a.window_start ?? a.valid_from ?? null;
        const end = a.window_end ?? a.valid_to ?? null;
        const days = Number(a.days_allowed ?? a.max_days ?? 0) || 0;
        const title =
          action === "updated"
            ? "Ausencia programada atualizada"
            : action === "deleted"
              ? "Liberacao de ausencia excluida"
              : action === "deactivated"
                ? "Liberacao de ausencia desativada"
                : "Ausencia programada liberada";
        const bodyText =
          action === "updated"
            ? `RH atualizou sua liberacao de ausencia para ${days} dia(s), no periodo de ${fmtDateBR(start)} ate ${fmtDateBR(end)}.`
            : action === "deleted"
              ? `RH excluiu sua liberacao de ausencia (periodo ${fmtDateBR(start)} ate ${fmtDateBR(end)}).`
              : action === "deactivated"
                ? `RH desativou sua liberacao de ausencia (${days} dia(s), periodo ${fmtDateBR(start)} ate ${fmtDateBR(end)}).`
                : `RH liberou ${days} dia(s) para solicitacao de ausencia no periodo de ${fmtDateBR(start)} ate ${fmtDateBR(end)}.`;
        return {
          to_user_id: userId,
          title,
          body: bodyText,
          link: rule?.link_default ?? "/meu-perfil/ausencias-programadas",
          type: eventKey,
        };
      })
      .filter(Boolean) as Array<{
        to_user_id: string;
        title: string;
        body: string;
        link: string;
        type: string;
      }>;

    if (!rows.length) {
      return NextResponse.json({ error: "Nenhum destinatario valido." }, { status: 400 });
    }

    const dedup = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      dedup.set(`${r.to_user_id}|${r.body}`, r);
    }

    const { error } = await supabaseAdmin.from("notifications").insert(Array.from(dedup.values()));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, notified: dedup.size, event_key: eventKey });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
