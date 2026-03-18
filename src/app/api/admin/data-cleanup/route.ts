import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "colaborador" | "rh" | "admin";

type GuardOk = {
  ok: true;
  userId: string;
  role: Role;
  companyId: string | null;
  token: string;
};

type GuardFail = {
  ok: false;
  status: number;
  error: string;
};

type CleanupAuditInput = {
  executionId: string;
  actorUserId: string;
  actorRole: Role;
  companyId: string | null;
  operationKey: string;
  status: "success" | "failed";
  operationPayload?: Record<string, unknown> | null;
  operationResult?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

async function requireRole(req: NextRequest, allowedRoles: Role[]): Promise<GuardOk | GuardFail> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return { ok: false, status: 401, error: "Token ausente." };

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = userRes?.user;

  if (userErr || !user) return { ok: false, status: 401, error: "Token invalido." };

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role, active, company_id")
    .eq("id", user.id)
    .maybeSingle<{ role: Role; active: boolean; company_id: string | null }>();

  if (profileErr || !profile) return { ok: false, status: 403, error: "Perfil nao encontrado." };
  if (!profile.active) return { ok: false, status: 403, error: "Usuario inativo." };
  if (!allowedRoles.includes(profile.role)) return { ok: false, status: 403, error: "Acesso negado." };

  return { ok: true, userId: user.id, role: profile.role, companyId: profile.company_id ?? null, token };
}

function parseBoolean(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return fallback;
}

async function insertCleanupAudit(input: CleanupAuditInput) {
  try {
    await supabaseAdmin.from("data_cleanup_audit").insert({
      execution_id: input.executionId,
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole,
      company_id: input.companyId,
      operation_key: input.operationKey,
      status: input.status,
      operation_payload: input.operationPayload ?? null,
      operation_result: input.operationResult ?? null,
      error_message: input.errorMessage ?? null,
    });
  } catch {
    // Auditoria nunca deve derrubar a operação principal.
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ["admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const auditMode = (req.nextUrl.searchParams.get("audit") || "").trim().toLowerCase() === "1";
  if (auditMode) {
    const requestedCompanyId = (req.nextUrl.searchParams.get("company_id") || "").trim();
    const scopeCompanyId = requestedCompanyId || guard.companyId;
    const limitParam = Number(req.nextUrl.searchParams.get("limit") || 50);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    if (!scopeCompanyId) {
      return NextResponse.json({ error: "Empresa nao definida para este usuario." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("data_cleanup_audit")
      .select("id,execution_id,actor_user_id,actor_role,company_id,operation_key,status,operation_payload,operation_result,error_message,created_at")
      .eq("company_id", scopeCompanyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ audit: data ?? [] });
  }

  const companyIdParam = (req.nextUrl.searchParams.get("company_id") || "").trim();

  if (!companyIdParam) {
    return NextResponse.json({
      role: guard.role,
      company_id: guard.companyId,
      capabilities: {
        clear_deliverable_history: true,
        clear_notifications: true,
        clear_company_projects: true,
      },
    });
  }

  const scopeCompanyId = companyIdParam || guard.companyId;

  if (!scopeCompanyId) {
    return NextResponse.json({ error: "Empresa nao definida para este usuario." }, { status: 400 });
  }

  const { data: projects, error: prErr } = await supabaseAdmin
    .from("projects")
    .select("id, name, status, created_at")
    .eq("company_id", scopeCompanyId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (prErr) return NextResponse.json({ error: prErr.message }, { status: 400 });

  return NextResponse.json({ projects: projects ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ["admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const executionId = crypto.randomUUID();
    const body = (await req.json()) as Record<string, unknown>;

    const requestedCompanyId = typeof body.company_id === "string" ? body.company_id.trim() : "";
    const scopeCompanyId = requestedCompanyId || guard.companyId;

    const clearDeliverableHistory = parseBoolean(body.clear_deliverable_history, false);
    const clearNotifications = parseBoolean(body.clear_notifications, false);
    const clearCompanyProjects = parseBoolean(body.clear_company_projects, false);
    const clearSessionAudit = parseBoolean(body.clear_session_audit, false);
    const retentionDaysRaw = Number(body.session_audit_retention_days ?? 180);
    const sessionAuditRetentionDays = Number.isFinite(retentionDaysRaw)
      ? Math.min(Math.max(Math.round(retentionDaysRaw), 1), 3650)
      : 180;

    if (!clearDeliverableHistory && !clearNotifications && !clearCompanyProjects && !clearSessionAudit) {
      return NextResponse.json({ error: "Selecione ao menos um tipo de limpeza." }, { status: 400 });
    }

    if (!scopeCompanyId) {
      return NextResponse.json({ error: "Empresa de escopo nao definida." }, { status: 400 });
    }

    const result: Record<string, unknown> = { company_id: scopeCompanyId };

    if (clearDeliverableHistory) {
      const projectId = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id.trim() : null;
      const resetSubmissionFields = parseBoolean(
        body.reset_submission_fields,
        parseBoolean(body.include_deleted, false)
      );
      let histRes: unknown = null;
      let histErr: { message: string } | null = null;

      if (projectId) {
        const singleRun = await supabaseAdmin.rpc("clear_project_deliverable_history", {
          p_project_id: projectId,
          p_deliverable_id: null,
          p_reset_submission_fields: resetSubmissionFields,
        });
        histRes = singleRun.data ?? null;
        histErr = singleRun.error ? { message: singleRun.error.message } : null;
      } else {
        const projectIds = new Set<string>();

        const projectList = await supabaseAdmin
          .from("projects")
          .select("id")
          .eq("company_id", scopeCompanyId);

        if (projectList.error) {
          histErr = { message: projectList.error.message };
        } else {
          for (const p of projectList.data ?? []) {
            if (p?.id) projectIds.add(p.id);
          }

          // Fallback para projetos legados sem company_id:
          // considera owner/membros que pertencem a esta empresa.
          const companyUsers = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("company_id", scopeCompanyId)
            .eq("active", true);

          if (companyUsers.error) {
            histErr = { message: companyUsers.error.message };
          } else {
            const companyUserIds = (companyUsers.data ?? []).map((u) => u.id).filter(Boolean) as string[];

            if (companyUserIds.length > 0) {
              const [ownerProjects, memberProjects] = await Promise.all([
                supabaseAdmin.from("projects").select("id").in("owner_user_id", companyUserIds),
                supabaseAdmin.from("project_members").select("project_id").in("user_id", companyUserIds),
              ]);

              if (ownerProjects.error) {
                histErr = { message: ownerProjects.error.message };
              } else if (memberProjects.error) {
                histErr = { message: memberProjects.error.message };
              } else {
                for (const p of ownerProjects.data ?? []) {
                  if (p?.id) projectIds.add(p.id);
                }
                for (const m of memberProjects.data ?? []) {
                  if (m?.project_id) projectIds.add(m.project_id);
                }
              }
            }
          }
        }

        if (!histErr) {
          const ids = Array.from(projectIds);
          let timelineDeleted = 0;
          let contributionsDeleted = 0;
          let filesDeleted = 0;
          let deliverablesUpdated = 0;
          let processedProjects = 0;

          for (const id of ids) {
            const run = await supabaseAdmin.rpc("clear_project_deliverable_history", {
              p_project_id: id,
              p_deliverable_id: null,
              p_reset_submission_fields: resetSubmissionFields,
            });
            if (run.error) {
              histErr = { message: run.error.message };
              break;
            }

            const data = (run.data ?? {}) as Record<string, unknown>;
            timelineDeleted += Number(data.timeline_deleted ?? 0) || 0;
            contributionsDeleted += Number(data.contributions_deleted ?? 0) || 0;
            filesDeleted += Number(data.files_deleted ?? 0) || 0;
            deliverablesUpdated += Number(data.deliverables_updated ?? 0) || 0;
            processedProjects += 1;
          }

          if (!histErr) {
            histRes = {
              ok: true,
              processed_projects: processedProjects,
              timeline_deleted: timelineDeleted,
              contributions_deleted: contributionsDeleted,
              files_deleted: filesDeleted,
              deliverables_updated: deliverablesUpdated,
            };
          }
        }
      }

      if (histErr) {
        await insertCleanupAudit({
          executionId,
          actorUserId: guard.userId,
          actorRole: guard.role,
          companyId: scopeCompanyId,
            operationKey: "clear_deliverable_history",
            status: "failed",
            operationPayload: { project_id: projectId, reset_submission_fields: resetSubmissionFields },
            errorMessage: histErr.message,
          });
        return NextResponse.json({ error: `Falha no historico de entregaveis: ${histErr.message}` }, { status: 400 });
      }

      result.deliverable_history = histRes ?? null;
      await insertCleanupAudit({
        executionId,
        actorUserId: guard.userId,
        actorRole: guard.role,
        companyId: scopeCompanyId,
        operationKey: "clear_deliverable_history",
        status: "success",
        operationPayload: { project_id: projectId, reset_submission_fields: resetSubmissionFields },
        operationResult: { response: histRes ?? null },
      });
    }

    if (clearNotifications) {
      const { data: companyUsers, error: usersErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("company_id", scopeCompanyId);

      if (usersErr) {
        await insertCleanupAudit({
          executionId,
          actorUserId: guard.userId,
          actorRole: guard.role,
          companyId: scopeCompanyId,
          operationKey: "clear_notifications",
          status: "failed",
          operationPayload: {},
          errorMessage: usersErr.message,
        });
        return NextResponse.json({ error: `Falha ao listar usuarios da empresa: ${usersErr.message}` }, { status: 400 });
      }

      const ids = (companyUsers ?? []).map((u) => u.id).filter(Boolean);
      let deletedCount = 0;

      if (ids.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const delRes = await supabaseAdmin.from("notifications").delete({ count: "exact" }).in("to_user_id", chunk);
          if (delRes.error) {
            await insertCleanupAudit({
              executionId,
              actorUserId: guard.userId,
              actorRole: guard.role,
              companyId: scopeCompanyId,
              operationKey: "clear_notifications",
              status: "failed",
              operationPayload: { chunk_size: chunk.length },
              errorMessage: delRes.error.message,
            });
            return NextResponse.json({ error: `Falha ao limpar notificacoes: ${delRes.error.message}` }, { status: 400 });
          }
          deletedCount += delRes.count ?? 0;
        }
      }

      result.notifications_deleted = deletedCount;
      await insertCleanupAudit({
        executionId,
        actorUserId: guard.userId,
        actorRole: guard.role,
        companyId: scopeCompanyId,
        operationKey: "clear_notifications",
        status: "success",
        operationPayload: {},
        operationResult: { notifications_deleted: deletedCount },
      });
    }

    if (clearCompanyProjects) {
      const { data: clearRes, error: clearErr } = await supabaseAdmin.rpc("clear_company_project_data", {
        p_company_id: scopeCompanyId,
      });

      if (clearErr) {
        await insertCleanupAudit({
          executionId,
          actorUserId: guard.userId,
          actorRole: guard.role,
          companyId: scopeCompanyId,
          operationKey: "clear_company_projects",
          status: "failed",
          operationPayload: {},
          errorMessage: clearErr.message,
        });
        return NextResponse.json({ error: `Falha ao limpar projetos da empresa: ${clearErr.message}` }, { status: 400 });
      }

      result.company_projects = clearRes ?? null;
      await insertCleanupAudit({
        executionId,
        actorUserId: guard.userId,
        actorRole: guard.role,
        companyId: scopeCompanyId,
        operationKey: "clear_company_projects",
        status: "success",
        operationPayload: {},
        operationResult: { response: clearRes ?? null },
      });
    }

    if (clearSessionAudit) {
      const cutoff = new Date(Date.now() - sessionAuditRetentionDays * 24 * 60 * 60 * 1000).toISOString();
      const delRes = await supabaseAdmin
        .from("session_audit")
        .delete({ count: "exact" })
        .eq("company_id", scopeCompanyId)
        .lt("last_seen_at", cutoff);

      if (delRes.error) {
        await insertCleanupAudit({
          executionId,
          actorUserId: guard.userId,
          actorRole: guard.role,
          companyId: scopeCompanyId,
          operationKey: "clear_session_audit",
          status: "failed",
          operationPayload: { retention_days: sessionAuditRetentionDays, cutoff },
          errorMessage: delRes.error.message,
        });
        return NextResponse.json({ error: `Falha ao limpar trilha de sessao: ${delRes.error.message}` }, { status: 400 });
      }

      result.session_audit = {
        retention_days: sessionAuditRetentionDays,
        cutoff,
        deleted: delRes.count ?? 0,
      };
      await insertCleanupAudit({
        executionId,
        actorUserId: guard.userId,
        actorRole: guard.role,
        companyId: scopeCompanyId,
        operationKey: "clear_session_audit",
        status: "success",
        operationPayload: { retention_days: sessionAuditRetentionDays, cutoff },
        operationResult: { deleted: delRes.count ?? 0 },
      });
    }

    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

