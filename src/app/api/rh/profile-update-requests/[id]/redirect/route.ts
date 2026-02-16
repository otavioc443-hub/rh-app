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
type RequestType = "financial" | "personal" | "contractual" | "avatar" | "other";

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

function deriveAssignedArea(requestType: RequestType, requestedChanges: Record<string, unknown> | null): AssignedArea {
  const explicit = requestedChanges?.assigned_area;
  if (explicit === "rh" || explicit === "financeiro") return explicit;
  return requestType === "financial" ? "financeiro" : "rh";
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

    const body = (await req.json()) as { assigned_area?: AssignedArea; notes?: string | null };
    const nextArea = body.assigned_area;
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    if (nextArea !== "rh" && nextArea !== "financeiro") {
      return NextResponse.json({ error: "Destino invalido" }, { status: 400 });
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
        request_type: RequestType;
        requested_changes: Record<string, unknown> | null;
      }>();

    if (reqErr || !requestRow) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }

    const currentArea = deriveAssignedArea(requestRow.request_type, requestRow.requested_changes);
    if (actorRole !== "admin") {
      if (actorRole === "rh" && currentArea !== "rh") {
        return NextResponse.json({ error: "Sem permissao para redirecionar esta fila" }, { status: 403 });
      }
      if (actorRole === "financeiro" && currentArea !== "financeiro") {
        return NextResponse.json({ error: "Sem permissao para redirecionar esta fila" }, { status: 403 });
      }
    }

    if (currentArea === nextArea) {
      return NextResponse.json({ error: "Solicitacao ja esta nesta fila" }, { status: 400 });
    }

    const prev = requestRow.requested_changes && typeof requestRow.requested_changes === "object"
      ? requestRow.requested_changes
      : {};

    const routingEntry = {
      from: currentArea,
      to: nextArea,
      at: new Date().toISOString(),
      by: actor.id,
      role: actorRole,
      notes,
    };

    const existingHistory = Array.isArray((prev as { routing_history?: unknown }).routing_history)
      ? ((prev as { routing_history?: unknown[] }).routing_history ?? [])
      : [];

    const nextRequestedChanges: Record<string, unknown> = {
      ...prev,
      assigned_area: nextArea,
      routing_history: [...existingHistory, routingEntry],
    };

    const { error: updateErr } = await supabaseAdmin
      .from("profile_update_requests")
      .update({
        requested_changes: nextRequestedChanges,
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    const auditText = notes
      ? `Redirecionada de ${currentArea} para ${nextArea}. Motivo: ${notes}`
      : `Redirecionada de ${currentArea} para ${nextArea}.`;

    const { error: auditErr } = await supabaseAdmin.from("profile_update_request_audit").insert({
      request_id: id,
      requester_user_id: requestRow.requester_user_id,
      actor_user_id: actor.id,
      actor_role: actorRole,
      status_from: requestRow.status,
      status_to: requestRow.status,
      notes: auditText,
    });
    if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 400 });

    const notifyRes = await supabaseAdmin.from("notifications").insert({
      to_user_id: requestRow.requester_user_id,
      title: `Solicitacao redirecionada: ${requestRow.title}`,
      body: `Sua solicitacao foi encaminhada para o time ${nextArea.toUpperCase()}.`,
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
