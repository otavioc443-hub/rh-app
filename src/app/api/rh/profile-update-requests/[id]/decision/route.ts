import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RequestStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "implemented"
  | "cancelled";
type AssignedArea = "rh" | "financeiro";

const ALLOWED_STATUS: RequestStatus[] = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "implemented",
  "cancelled",
];

function deriveAssignedArea(
  requestType: "financial" | "personal" | "contractual" | "avatar" | "other",
  requestedChanges: Record<string, unknown> | null
): AssignedArea {
  const explicit = requestedChanges?.assigned_area;
  if (explicit === "rh" || explicit === "financeiro") return explicit;
  return requestType === "financial" ? "financeiro" : "rh";
}

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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "id da solicitacao e obrigatorio" }, { status: 400 });

    const requester = await getRequesterUser(req);
    const actor = requester.user;
    if (!actor) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const { data: actorProfile, error: actorErr } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", actor.id)
      .maybeSingle<{ role: string | null; active: boolean | null }>();

    if (actorErr || !actorProfile?.active) {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }
    const actorRole = String(actorProfile.role ?? "");
    if (!["admin", "rh", "financeiro"].includes(actorRole)) {
      return NextResponse.json({ error: "Apenas RH/Admin/Financeiro" }, { status: 403 });
    }

    const body = (await req.json()) as { status?: RequestStatus; review_notes?: string | null };
    const nextStatus = String(body.status ?? "") as RequestStatus;
    const reviewNotes =
      typeof body.review_notes === "string" && body.review_notes.trim() ? body.review_notes.trim() : null;
    if (!ALLOWED_STATUS.includes(nextStatus)) {
      return NextResponse.json({ error: "Status invalido" }, { status: 400 });
    }

    const { data: requestRow, error: reqErr } = await supabaseAdmin
      .from("profile_update_requests")
      .select("id,requester_user_id,status,title,request_type,requested_changes")
      .eq("id", id)
      .maybeSingle<{
        id: string;
        requester_user_id: string;
        status: RequestStatus;
        title: string;
        request_type: "financial" | "personal" | "contractual" | "avatar" | "other";
        requested_changes: Record<string, unknown> | null;
      }>();

    if (reqErr || !requestRow) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    const assignedArea = deriveAssignedArea(requestRow.request_type, requestRow.requested_changes);
    if (actorRole !== "admin") {
      if (actorRole === "financeiro" && assignedArea !== "financeiro") {
        return NextResponse.json({ error: "Sem permissao para esta fila" }, { status: 403 });
      }
      if (actorRole === "rh" && assignedArea !== "rh") {
        return NextResponse.json({ error: "Sem permissao para esta fila" }, { status: 403 });
      }
    }

    const previousStatus = requestRow.status;
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabaseAdmin
      .from("profile_update_requests")
      .update({
        status: nextStatus,
        review_notes: reviewNotes,
        reviewed_by: actor.id,
        reviewed_at: nowIso,
      })
      .eq("id", id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    const { error: auditErr } = await supabaseAdmin.from("profile_update_request_audit").insert({
      request_id: id,
      requester_user_id: requestRow.requester_user_id,
      actor_user_id: actor.id,
      actor_role: actorRole,
      status_from: previousStatus,
      status_to: nextStatus,
      notes: reviewNotes,
    });
    if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 400 });

    // Notificacao ao colaborador (se tabela existir).
    const notificationTitle = `Solicitacao atualizada: ${requestRow.title}`;
    const notificationBody = reviewNotes
      ? `Status: ${nextStatus}. Observacao: ${reviewNotes}`
      : `Status atualizado para ${nextStatus}.`;
    const notifyRes = await supabaseAdmin.from("notifications").insert({
      to_user_id: requestRow.requester_user_id,
      title: notificationTitle,
      body: notificationBody,
      link: "/meu-perfil/meus-dados",
      type: "profile_update_request",
    });
    if (notifyRes.error) {
      const text = notifyRes.error.message.toLowerCase();
      const ignorable =
        text.includes("does not exist") ||
        text.includes("relation") ||
        text.includes("schema cache") ||
        text.includes("column");
      if (!ignorable) {
        return NextResponse.json({ error: notifyRes.error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
