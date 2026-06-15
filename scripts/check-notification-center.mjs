import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationPath = path.join(root, "supabase", "sql", "2026-06-15_make_megaphone_single_notification_center.sql");
const helperPath = path.join(root, "src", "lib", "server", "notifications.ts");
const readRoutePath = path.join(root, "src", "app", "api", "notifications", "read", "route.ts");

const requiredEventKeys = [
  "home_announcement",
  "pulsehub_announcement",
  "pulsehub_campaign",
  "support_ticket_created",
  "invoice_submitted",
  "invoice_approved",
  "invoice_rejected",
  "invoice_cancelled",
  "extra_payment_created",
  "extra_payment_approved",
  "extra_payment_rejected",
  "extra_payment_paid",
  "feedback_submitted",
  "feedback_released",
  "pdi_created",
  "pdi_updated",
  "behavior_invite",
  "behavior_completed",
  "lgpd_request_created",
  "lgpd_request_updated",
  "ethics_case_created",
  "ethics_case_updated",
  "pd_ticket_created",
  "pd_ticket_updated",
  "institutional_event_created",
  "lms_assignment",
  "lms_due_soon",
  "lms_overdue",
  "lms_lesson_question",
  "lms_lesson_answer",
  "lms_quiz_review",
  "lms_quiz_reviewed",
  "lms_manual_reminder",
  "lms_weekly_summary",
];

const checks = [];

function check(label, ok, detail = "") {
  checks.push({ label, ok, detail });
}

function readRequired(filePath) {
  if (!existsSync(filePath)) {
    check(`Arquivo existe: ${path.relative(root, filePath)}`, false);
    return "";
  }
  check(`Arquivo existe: ${path.relative(root, filePath)}`, true);
  return readFileSync(filePath, "utf8");
}

const migration = readRequired(migrationPath);
const helper = readRequired(helperPath);
const readRoute = readRequired(readRoutePath);

if (migration) {
  check("Migration remove fanout global para admins", migration.includes("drop trigger if exists trg_fanout_notification_to_admins") && migration.includes("drop function if exists public.fanout_notification_to_admins"));
  check("Migration cria deduplicacao por usuario", migration.includes("idx_notifications_dedup_key") && migration.includes("to_user_id, dedup_key"));
  check("Migration cria metadados de categoria/severidade/acao", ["category", "severity", "action_required", "entity_type", "entity_id", "data"].every((column) => migration.includes(column)));
  check("Migration cria funcao de retencao", migration.includes("cleanup_old_notifications"));
  for (const key of requiredEventKeys) {
    check(`Regra cadastrada: ${key}`, migration.includes(`'${key}'`));
  }
}

if (helper) {
  check("Helper consulta regras de automacao", helper.includes("notification_automation_rules") && helper.includes(".in(\"event_key\", eventTypes)"));
  check("Helper respeita regras desativadas", helper.includes("enabledByType.get(item.type) === false"));
  check("Helper aplica upsert deduplicado", helper.includes(".upsert(rows") && helper.includes("onConflict: \"to_user_id,dedup_key\""));
  check("Helper categoriza notificacoes", helper.includes("function categoryFromType") && helper.includes("function severityFromType"));
}

if (readRoute) {
  check("Endpoint permite marcar por filtro", readRoute.includes("category") && readRoute.includes("actionRequired") && readRoute.includes("unread"));
  check("Endpoint usa usuario autenticado", readRoute.includes('requireRoles(["colaborador"') && readRoute.includes('.eq("to_user_id", access.userId)'));
}

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  const marker = item.ok ? "ok" : "fail";
  console.log(`[${marker}] ${item.label}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} verificacao(oes) falharam.`);
  process.exit(1);
}

console.log("\nCentral do megafone verificada com sucesso.");
