import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { sendPortalEmail } from "@/lib/server/mailer";

type NotifyAction = "created" | "updated" | "cancelled" | "approved" | "rejected";
type NotifyRole = "colaborador" | "gestor" | "rh" | "admin";

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

type ProfileEmailRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CollaboratorEmailRow = {
  user_id: string | null;
  nome: string | null;
  email: string | null;
  email_empresarial: string | null;
  email_pessoal: string | null;
  superior_direto?: string | null;
  email_superior_direto?: string | null;
  company_id?: string | null;
};

const PORTAL_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rh-app-seven.vercel.app").replace(/\/$/, "");

async function requireNotifyAccess(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return requireRoles(["colaborador", "gestor", "rh", "admin"]);

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return { ok: false as const, status: 401, error: "Nao autenticado." };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .maybeSingle<{ role: NotifyRole | null; active: boolean | null }>();

  if (profileError || profile?.active === false || !profile?.role) {
    return { ok: false as const, status: 403, error: "Perfil sem permissao." };
  }

  if (!["colaborador", "gestor", "rh", "admin"].includes(profile.role)) {
    return { ok: false as const, status: 403, error: "Acesso negado." };
  }

  return { ok: true as const };
}

function fmtDateBR(raw: string | null | undefined) {
  if (!raw) return "-";
  const s = String(raw).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (y && m && d) return `${d}/${m}/${y}`;
  return String(raw);
}

function clean(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanEmail(value: string | null | undefined) {
  return clean(value).toLowerCase();
}

function normalizeText(value: string | null | undefined) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstEmail(...values: Array<string | null | undefined>) {
  return values.map(clean).find((value) => value.includes("@")) ?? "";
}

async function findActiveProfileId(userId: string | null | undefined) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,active")
    .eq("id", userId)
    .maybeSingle<{ id: string; active: boolean | null }>();
  if (error || !data || data.active === false) return null;
  return data.id;
}

async function findProfileIdByEmail(email: string) {
  if (!email) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,active")
    .ilike("email", email)
    .limit(5);
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; active: boolean | null }>).find((item) => item.active !== false)?.id ?? null;
}

async function findManagerIdByEmail(email: string, companyId: string | null) {
  if (!email) return null;
  const { data, error } = await supabaseAdmin
    .from("colaboradores")
    .select("user_id,nome,email,email_empresarial,email_pessoal,company_id")
    .or(`email.ilike.${email},email_empresarial.ilike.${email},email_pessoal.ilike.${email}`)
    .limit(10);
  if (error) throw error;

  const candidates = ((data ?? []) as CollaboratorEmailRow[]).filter((item) => !companyId || item.company_id === companyId);
  for (const candidate of candidates) {
    const profileId = await findActiveProfileId(candidate.user_id);
    if (profileId) return profileId;
  }

  return findProfileIdByEmail(email);
}

async function findManagerIdByName(name: string, companyId: string | null) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;

  let query = supabaseAdmin
    .from("colaboradores")
    .select("user_id,nome,email,email_empresarial,email_pessoal,company_id")
    .limit(100);
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) throw error;

  const candidates = ((data ?? []) as CollaboratorEmailRow[]).filter((item) => {
    const candidateName = normalizeText(item.nome);
    return candidateName === normalizedName || candidateName.includes(normalizedName) || normalizedName.includes(candidateName);
  });

  for (const candidate of candidates) {
    const profileId = await findActiveProfileId(candidate.user_id);
    if (profileId) return profileId;
    const emailProfileId =
      (await findProfileIdByEmail(cleanEmail(candidate.email))) ||
      (await findProfileIdByEmail(cleanEmail(candidate.email_empresarial))) ||
      (await findProfileIdByEmail(cleanEmail(candidate.email_pessoal)));
    if (emailProfileId) return emailProfileId;
  }

  return null;
}

async function resolveManagerIdForRequester(requesterId: string, fallbackManagerId: string | null) {
  const { data: requester, error } = await supabaseAdmin
    .from("colaboradores")
    .select("user_id,nome,email,email_empresarial,email_pessoal,superior_direto,email_superior_direto,company_id")
    .eq("user_id", requesterId)
    .maybeSingle<CollaboratorEmailRow>();
  if (error) throw error;
  if (!requester) return fallbackManagerId;

  const managerEmail = cleanEmail(requester.email_superior_direto);
  const managerName = clean(requester.superior_direto);
  const companyId = clean(requester.company_id) || null;
  return (await findManagerIdByEmail(managerEmail, companyId)) || (await findManagerIdByName(managerName, companyId)) || fallbackManagerId;
}

async function loadPeopleForEmail(userIds: string[]) {
  const ids = Array.from(new Set(userIds.map(clean).filter(Boolean)));
  if (!ids.length) return new Map<string, { name: string; email: string }>();

  const [profilesRes, collaboratorsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id,full_name,email").in("id", ids),
    supabaseAdmin
      .from("colaboradores")
      .select("user_id,nome,email,email_empresarial,email_pessoal")
      .in("user_id", ids),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (collaboratorsRes.error) throw collaboratorsRes.error;

  const out = new Map<string, { name: string; email: string }>();
  for (const profile of (profilesRes.data ?? []) as ProfileEmailRow[]) {
    out.set(profile.id, {
      name: clean(profile.full_name) || clean(profile.email) || "Usuario",
      email: firstEmail(profile.email),
    });
  }
  for (const collaborator of (collaboratorsRes.data ?? []) as CollaboratorEmailRow[]) {
    const userId = clean(collaborator.user_id);
    if (!userId) continue;
    const current = out.get(userId);
    out.set(userId, {
      name: clean(collaborator.nome) || current?.name || "Usuario",
      email: firstEmail(collaborator.email_empresarial, collaborator.email, collaborator.email_pessoal, current?.email),
    });
  }

  return out;
}

async function sendAbsenceCreatedEmail(input: {
  managerEmail: string;
  managerName: string;
  requesterName: string;
  periodText: string;
  days: number;
  reasonText: string;
}) {
  const to = clean(input.managerEmail);
  if (!to) return { sent: false, skipped: true as const };

  const approvalUrl = `${PORTAL_ORIGIN}/gestor/ausencias`;
  const reasonLine = input.reasonText
    ? `<p><strong>Motivo informado:</strong> ${escapeHtml(input.reasonText)}</p>`
    : "";

  return sendPortalEmail({
    to,
    subject: "Ausencia pendente de aprovacao",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px">Ausencia pendente de aprovacao</h2>
        <p>Ola, ${escapeHtml(input.managerName || "gestor")}.</p>
        <p><strong>${escapeHtml(input.requesterName || "Colaborador")}</strong> solicitou uma ausencia e aguarda sua aprovacao.</p>
        <p><strong>Periodo:</strong> ${escapeHtml(input.periodText)}</p>
        <p><strong>Quantidade:</strong> ${escapeHtml(input.days)} dia(s)</p>
        ${reasonLine}
        <p>
          <a href="${escapeHtml(approvalUrl)}" style="display:inline-block;background:#020617;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700">
            Acessar aprovacoes
          </a>
        </p>
        <p style="font-size:12px;color:#64748b">Este e-mail foi enviado automaticamente pelo Portal de RH.</p>
      </div>
    `,
    text: `Ausencia pendente de aprovacao\n\n${input.requesterName} solicitou ausencia.\nPeriodo: ${input.periodText}\nQuantidade: ${input.days} dia(s)\n${input.reasonText ? `Motivo: ${input.reasonText}\n` : ""}Acesse: ${approvalUrl}`,
  });
}

export async function POST(req: Request) {
  const guard = await requireNotifyAccess(req);
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

    const notificationDisabled = rule?.enabled === false;

    const rows: Array<{ to_user_id: string; title: string; body: string; link: string; type: string }> = [];
    const createdEmailJobs: Array<{
      requesterId: string;
      managerId: string;
      periodText: string;
      days: number;
      reasonText: string;
    }> = [];

    for (const r of requests) {
      const requesterId = String(r.user_id ?? "").trim();
      if (!requesterId) continue;
      const fallbackManagerId = String(r.manager_id ?? "").trim() || null;
      const managerId = await resolveManagerIdForRequester(requesterId, fallbackManagerId);

      if (r.id && managerId && managerId !== fallbackManagerId) {
        await supabaseAdmin.from("absence_requests").update({ manager_id: managerId }).eq("id", r.id);
      }

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

      if (action === "created" && managerId) {
        createdEmailJobs.push({ requesterId, managerId, periodText, days, reasonText });
      }
    }

    const dedup = new Map<string, (typeof rows)[number]>();
    for (const row of rows) dedup.set(`${row.to_user_id}|${row.type}|${row.body}`, row);

    let notified = 0;
    const forceWorkflowNotification = eventKey.startsWith("absence_request_");
    if ((!notificationDisabled || forceWorkflowNotification) && dedup.size) {
      const { error } = await supabaseAdmin.from("notifications").insert(Array.from(dedup.values()));
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      notified = dedup.size;
    }

    let emailSent = 0;
    let emailSkipped = 0;
    let emailFailed = 0;
    if (action === "created" && createdEmailJobs.length) {
      const people = await loadPeopleForEmail(
        createdEmailJobs.flatMap((job) => [job.requesterId, job.managerId])
      );
      const sentKeys = new Set<string>();

      for (const job of createdEmailJobs) {
        const manager = people.get(job.managerId);
        const requester = people.get(job.requesterId);
        const key = `${manager?.email ?? ""}|${job.requesterId}|${job.periodText}`;
        if (!manager?.email || sentKeys.has(key)) {
          emailSkipped += 1;
          continue;
        }
        sentKeys.add(key);

        try {
          const result = await sendAbsenceCreatedEmail({
            managerEmail: manager.email,
            managerName: manager.name,
            requesterName: requester?.name ?? "Colaborador",
            periodText: job.periodText,
            days: job.days,
            reasonText: job.reasonText,
          });
          if (result.sent) emailSent += 1;
          else emailSkipped += 1;
        } catch (emailError) {
          emailFailed += 1;
          console.error("Falha ao enviar e-mail de ausencia pendente:", emailError);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      notified,
      skipped: notificationDisabled && !forceWorkflowNotification ? "event_disabled" : !dedup.size ? "no_internal_recipients" : undefined,
      event_key: eventKey,
      emailSent,
      emailSkipped,
      emailFailed,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado." }, { status: 500 });
  }
}
