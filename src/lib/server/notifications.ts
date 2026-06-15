import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type NotificationPayload = {
  to_user_id: string;
  title: string;
  body: string;
  link?: string | null;
  type: string;
  category?: string | null;
  severity?: "info" | "success" | "warning" | "critical";
  action_required?: boolean;
  entity_type?: string | null;
  entity_id?: string | null;
  dedup_key?: string | null;
  data?: Record<string, unknown> | null;
};

export type NotificationRole =
  | "colaborador"
  | "coordenador"
  | "gestor"
  | "diretoria"
  | "rh"
  | "financeiro"
  | "pd"
  | "admin"
  | "compliance";

function isIgnorableNotificationError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("relation") ||
    text.includes("schema cache") ||
    text.includes("column")
  );
}

export async function insertNotifications(payload: NotificationPayload[]) {
  const eventTypes = Array.from(new Set(payload.map((item) => item.type).filter(Boolean)));
  const enabledByType = new Map<string, boolean>();
  if (eventTypes.length) {
    const { data } = await supabaseAdmin
      .from("notification_automation_rules")
      .select("event_key,enabled")
      .in("event_key", eventTypes);
    for (const row of (data ?? []) as Array<{ event_key: string; enabled: boolean | null }>) {
      enabledByType.set(row.event_key, row.enabled !== false);
    }
  }

  const dedup = new Map<string, NotificationPayload>();
  for (const item of payload) {
    if (enabledByType.get(item.type) === false) continue;
    const userId = String(item.to_user_id ?? "").trim();
    const title = item.title.trim();
    const body = item.body.trim();
    if (!userId || !title || !body) continue;
    const dedupKey = item.dedup_key ?? (item.entity_type && item.entity_id ? `${item.type}:${item.entity_type}:${item.entity_id}` : null);
    dedup.set(dedupKey ? `${userId}|${dedupKey}` : `${userId}|${item.type}|${item.link ?? ""}|${title}|${body}`, {
      ...item,
      to_user_id: userId,
      title,
      body,
      link: item.link ?? null,
      category: item.category ?? categoryFromType(item.type),
      severity: item.severity ?? severityFromType(item.type),
      action_required: item.action_required ?? actionRequiredFromType(item.type),
      entity_type: item.entity_type ?? null,
      entity_id: item.entity_id ?? null,
      dedup_key: dedupKey,
      data: item.data ?? {},
    });
  }

  const rows = Array.from(dedup.values());
  if (!rows.length) return { inserted: 0 };

  const { error } = await supabaseAdmin.from("notifications").upsert(rows, {
    onConflict: "to_user_id,dedup_key",
    ignoreDuplicates: true,
  });
  if (error) {
    if (isIgnorableNotificationError(error.message)) return { inserted: 0, skipped: true };
    throw error;
  }

  return { inserted: rows.length };
}

function categoryFromType(type: string) {
  if (type.startsWith("absence_")) return "ausencias";
  if (type.startsWith("lms_")) return "lms";
  if (type.startsWith("invoice_")) return "financeiro";
  if (type.startsWith("extra_payment_")) return "financeiro";
  if (type.startsWith("pulsehub_") || type === "home_announcement") return "comunicados";
  if (type.includes("deliverable") || type === "project_updated") return "projetos";
  if (type.includes("feedback") || type.startsWith("pdi_")) return "desenvolvimento";
  if (type.startsWith("behavior_")) return "mapa";
  if (type.startsWith("lgpd_")) return "privacidade";
  if (type.startsWith("ethics_")) return "etica";
  if (type.startsWith("pd_ticket") || type === "support_ticket_created") return "chamados";
  return "geral";
}

function severityFromType(type: string): "info" | "success" | "warning" | "critical" {
  if (type.includes("rejected") || type.includes("overdue") || type.includes("ethics") || type.includes("lgpd")) return "warning";
  if (type.includes("approved") || type.includes("paid") || type.includes("completed")) return "success";
  if (type.includes("critical")) return "critical";
  return "info";
}

function actionRequiredFromType(type: string) {
  return (
    type.endsWith("_created") ||
    type.includes("submitted") ||
    type.includes("review") ||
    type.includes("due_soon") ||
    type.includes("overdue") ||
    type.includes("question")
  );
}

export async function getActiveProfileIdsByRoles(roles: NotificationRole[], companyId?: string | null) {
  let query = supabaseAdmin.from("profiles").select("id,company_id").eq("active", true).in("role", roles);
  if (companyId) query = query.or(`company_id.eq.${companyId},company_id.is.null`);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; company_id: string | null }>).map((row) => row.id);
}

export async function getBroadcastProfileIds(companyId?: string | null, excludeUserIds: string[] = []) {
  let query = supabaseAdmin.from("profiles").select("id,company_id").eq("active", true);
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) throw error;

  const excluded = new Set(excludeUserIds.filter(Boolean));
  return ((data ?? []) as Array<{ id: string; company_id: string | null }>)
    .map((row) => row.id)
    .filter((id) => !excluded.has(id));
}

export async function notifyRoles(
  roles: NotificationRole[],
  notification: Omit<NotificationPayload, "to_user_id">,
  options?: { companyId?: string | null; excludeUserIds?: string[] },
) {
  const ids = await getActiveProfileIdsByRoles(roles, options?.companyId ?? null);
  const excluded = new Set(options?.excludeUserIds ?? []);
  return insertNotifications(
    ids
      .filter((id) => !excluded.has(id))
      .map((id) => ({
        to_user_id: id,
        ...notification,
      })),
  );
}
