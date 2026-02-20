import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ContractEventType =
  | "aditivo_valor"
  | "prorrogacao_prazo"
  | "aditivo_escopo"
  | "notificacao"
  | "rescisao"
  | "outro";

type ContractEventStatus =
  | "registrado"
  | "em_analise"
  | "aprovado"
  | "rejeitado"
  | "executado"
  | "cancelado";

const TYPES: ContractEventType[] = [
  "aditivo_valor",
  "prorrogacao_prazo",
  "aditivo_escopo",
  "notificacao",
  "rescisao",
  "outro",
];

const STATUSES: ContractEventStatus[] = [
  "registrado",
  "em_analise",
  "aprovado",
  "rejeitado",
  "executado",
  "cancelado",
];

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, status: 401 as const };
    return { user: data.user, status: 200 as const };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const) };
}

async function safeNotify(toUserIds: string[], title: string, body: string, link: string, type: string) {
  const uniqueIds = Array.from(new Set(toUserIds.filter(Boolean)));
  if (!uniqueIds.length) return;
  const payload = uniqueIds.map((id) => ({ to_user_id: id, title, body, link, type }));
  const res = await supabaseAdmin.from("notifications").insert(payload);
  if (!res.error) return;

  const text = res.error.message.toLowerCase();
  const ignorable =
    text.includes("does not exist") ||
    text.includes("relation") ||
    text.includes("schema cache") ||
    text.includes("column");
  if (!ignorable) throw new Error(res.error.message);
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    const actor = requester.user;
    if (!actor) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const { data: actorProfile, error: actorErr } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", actor.id)
      .maybeSingle<{ role: string | null; active: boolean | null }>();

    if (
      actorErr ||
      !actorProfile?.active ||
      !["diretoria", "admin"].includes(String(actorProfile.role ?? ""))
    ) {
      return NextResponse.json({ error: "Apenas Diretoria/Admin pode registrar." }, { status: 403 });
    }

    const body = (await req.json()) as {
      project_id?: string;
      event_type?: ContractEventType;
      status?: ContractEventStatus;
      effective_date?: string;
      title?: string;
      description?: string | null;
      additional_amount?: number | null;
      to_end_date?: string | null;
      notified_to?: string | null;
      apply_on_approval?: boolean;
    };

    const projectId = String(body.project_id ?? "").trim();
    const eventType = String(body.event_type ?? "") as ContractEventType;
    const inputStatus = String(body.status ?? "registrado") as ContractEventStatus;
    const effectiveDate = String(body.effective_date ?? "").trim();
    const title = String(body.title ?? "").trim();
    const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
    const notifiedTo = typeof body.notified_to === "string" && body.notified_to.trim() ? body.notified_to.trim() : null;
    const applyOnApproval = body.apply_on_approval === true;

    if (!projectId) return NextResponse.json({ error: "project_id obrigatorio." }, { status: 400 });
    if (!TYPES.includes(eventType)) return NextResponse.json({ error: "event_type invalido." }, { status: 400 });
    if (!STATUSES.includes(inputStatus)) return NextResponse.json({ error: "status invalido." }, { status: 400 });
    if (!effectiveDate) return NextResponse.json({ error: "effective_date obrigatorio." }, { status: 400 });
    if (!title) return NextResponse.json({ error: "title obrigatorio." }, { status: 400 });

    const { data: project, error: prErr } = await supabaseAdmin
      .from("projects")
      .select("id,name,budget_total,end_date,owner_user_id")
      .eq("id", projectId)
      .maybeSingle<{ id: string; name: string; budget_total: number | null; end_date: string | null; owner_user_id: string }>();
    if (prErr || !project) return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });

    const rawAmount = Number(body.additional_amount ?? 0);
    const amount = Number.isFinite(rawAmount) ? rawAmount : 0;
    if (eventType === "aditivo_valor" && amount <= 0) {
      return NextResponse.json({ error: "additional_amount deve ser maior que zero." }, { status: 400 });
    }

    const toEndDate = typeof body.to_end_date === "string" && body.to_end_date.trim() ? body.to_end_date.trim() : null;
    if (eventType === "prorrogacao_prazo" && !toEndDate) {
      return NextResponse.json({ error: "to_end_date obrigatorio para prorrogacao." }, { status: 400 });
    }

    const currentBudget = Number(project.budget_total) || 0;
    const nextBudget = eventType === "aditivo_valor" ? currentBudget + amount : null;
    const initialStatus: ContractEventStatus = eventType === "aditivo_valor" ? "em_analise" : inputStatus;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("project_contract_events")
      .insert({
        project_id: projectId,
        event_type: eventType,
        status: initialStatus,
        effective_date: effectiveDate,
        title,
        description,
        additional_amount: eventType === "aditivo_valor" ? amount : null,
        from_budget_total: eventType === "aditivo_valor" ? currentBudget : null,
        to_budget_total: eventType === "aditivo_valor" ? nextBudget : null,
        from_end_date: eventType === "prorrogacao_prazo" ? project.end_date : null,
        to_end_date: eventType === "prorrogacao_prazo" ? toEndDate : null,
        notified_to: notifiedTo,
        requested_by: actor.id,
        created_by: actor.id,
        apply_on_approval: applyOnApproval,
        applied_to_project: false,
      })
      .select("id")
      .single<{ id: string }>();
    if (insErr || !inserted) return NextResponse.json({ error: insErr?.message ?? "Falha ao registrar evento." }, { status: 400 });

    const { error: auditCreateErr } = await supabaseAdmin.from("project_contract_event_audit").insert({
      event_id: inserted.id,
      project_id: project.id,
      actor_user_id: actor.id,
      actor_role: actorProfile.role ?? "admin",
      action_type: "created",
      status_from: null,
      status_to: initialStatus,
      notes: title,
      metadata: {
        event_type: eventType,
        additional_amount: eventType === "aditivo_valor" ? amount : null,
        from_budget_total: eventType === "aditivo_valor" ? currentBudget : null,
        to_budget_total: eventType === "aditivo_valor" ? nextBudget : null,
        from_end_date: eventType === "prorrogacao_prazo" ? project.end_date : null,
        to_end_date: eventType === "prorrogacao_prazo" ? toEndDate : null,
        apply_on_approval: applyOnApproval,
      },
    });
    if (auditCreateErr) return NextResponse.json({ error: auditCreateErr.message }, { status: 400 });

    if (eventType !== "aditivo_valor" && applyOnApproval) {
      if (eventType === "prorrogacao_prazo" && toEndDate) {
        const updateProject = await supabaseAdmin.from("projects").update({ end_date: toEndDate }).eq("id", project.id);
        if (updateProject.error) return NextResponse.json({ error: updateProject.error.message }, { status: 400 });

        const updateEvent = await supabaseAdmin
          .from("project_contract_events")
          .update({ applied_to_project: true, applied_at: new Date().toISOString() })
          .eq("id", inserted.id);
        if (updateEvent.error) return NextResponse.json({ error: updateEvent.error.message }, { status: 400 });

        const { error: auditAppliedErr } = await supabaseAdmin.from("project_contract_event_audit").insert({
          event_id: inserted.id,
          project_id: project.id,
          actor_user_id: actor.id,
          actor_role: actorProfile.role ?? "admin",
          action_type: "applied_to_project",
          status_from: initialStatus,
          status_to: initialStatus,
          notes: "Aplicacao automatica do novo prazo no projeto.",
          metadata: {
            from_end_date: project.end_date,
            to_end_date: toEndDate,
          },
        });
        if (auditAppliedErr) return NextResponse.json({ error: auditAppliedErr.message }, { status: 400 });
      }
    }

    if (eventType === "aditivo_valor") {
      const { data: ceoUsers } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("active", true)
        .eq("role", "admin");
      const toIds = (ceoUsers ?? []).map((x) => String((x as { id: string }).id));
      await safeNotify(
        toIds,
        `Aprovacao do CEO pendente: ${project.name}`,
        `Novo aditivo de valor registrado (${fmtCurrency(amount)}).`,
        "/ceo/aditivos-contratuais",
        "project_contract_event"
      );
    } else {
      const [rhUsersRes, membersRes] = await Promise.all([
        supabaseAdmin.from("profiles").select("id").eq("active", true).eq("role", "rh"),
        supabaseAdmin
          .from("project_members")
          .select("user_id,member_role")
          .eq("project_id", project.id)
          .in("member_role", ["gestor", "coordenador"]),
      ]);
      const rhIds = (rhUsersRes.data ?? []).map((x) => String((x as { id: string }).id));
      const memberIds = (membersRes.data ?? []).map((x) => String((x as { user_id: string }).user_id));
      await safeNotify(
        [...rhIds, ...memberIds, project.owner_user_id],
        `Evento contratual registrado: ${project.name}`,
        `${eventTypeLabel(eventType)} - ${title}`,
        "/diretoria/contratos",
        "project_contract_event"
      );
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function eventTypeLabel(value: ContractEventType) {
  if (value === "aditivo_valor") return "Aditivo de valor";
  if (value === "prorrogacao_prazo") return "Prorrogacao de prazo";
  if (value === "aditivo_escopo") return "Aditivo de escopo";
  if (value === "notificacao") return "Notificacao";
  if (value === "rescisao") return "Rescisao";
  return "Outro";
}

function fmtCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
