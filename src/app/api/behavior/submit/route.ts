import { NextResponse } from "next/server";
import {
  calculateBehaviorAxisResults,
  getPredominantBehaviorAxes,
} from "@/lib/behaviorProfile";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeIds(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return Array.from(
    new Set(
      input
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter((v) => !!v)
    )
  );
}

function isExpired(iso: string | null) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return time < Date.now();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const selfSelectedIds = normalizeIds(body.selfSelectedIds);
    const othersSelectedIds = normalizeIds(body.othersSelectedIds);

    if (!token) {
      return NextResponse.json({ error: "Token obrigatorio." }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ error: "Nome obrigatorio." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "E-mail obrigatorio." }, { status: 400 });
    }
    if (!selfSelectedIds.length || !othersSelectedIds.length) {
      return NextResponse.json(
        { error: "Selecione adjetivos nas duas etapas." },
        { status: 400 }
      );
    }

    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("behavior_assessment_invites")
      .select("id,collaborator_id,email,status,expires_at")
      .eq("token", token)
      .maybeSingle<{
        id: string;
        collaborator_id: string | null;
        email: string;
        status: "pending" | "completed" | "expired" | "cancelled";
        expires_at: string | null;
      }>();
    if (inviteErr || !invite) {
      return NextResponse.json({ error: "Convite nao encontrado." }, { status: 404 });
    }
    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Este convite nao esta mais disponivel." },
        { status: 400 }
      );
    }
    if (isExpired(invite.expires_at)) {
      await supabaseAdmin
        .from("behavior_assessment_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return NextResponse.json({ error: "Convite expirado." }, { status: 400 });
    }

    const selfResult = calculateBehaviorAxisResults(selfSelectedIds);
    const othersResult = calculateBehaviorAxisResults(othersSelectedIds);
    const predominantSelf = getPredominantBehaviorAxes(selfResult).map(
      (item) => item.key
    );
    const predominantOthers = getPredominantBehaviorAxes(othersResult).map(
      (item) => item.key
    );

    let collaboratorId = invite.collaborator_id;
    let userId: string | null = null;
    if (collaboratorId) {
      const { data: c } = await supabaseAdmin
        .from("colaboradores")
        .select("id,user_id")
        .eq("id", collaboratorId)
        .maybeSingle<{ id: string; user_id: string | null }>();
      userId = c?.user_id ?? null;
    } else {
      const { data: cByMail } = await supabaseAdmin
        .from("colaboradores")
        .select("id,user_id")
        .eq("email", email.toLowerCase())
        .maybeSingle<{ id: string; user_id: string | null }>();
      collaboratorId = cByMail?.id ?? null;
      userId = cByMail?.user_id ?? null;
    }

    const payload: Record<string, unknown> = {
      collaborator_id: collaboratorId,
      invite_id: invite.id,
      full_name: fullName,
      email: email.toLowerCase(),
      self_selected_ids: selfSelectedIds,
      others_selected_ids: othersSelectedIds,
      self_result: selfResult,
      others_result: othersResult,
      predominant_self: predominantSelf,
      predominant_others: predominantOthers,
    };
    if (userId) payload.user_id = userId;

    const { error: insertErr } = await supabaseAdmin
      .from("behavior_assessments")
      .insert(payload);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }

    const { error: inviteUpdateErr } = await supabaseAdmin
      .from("behavior_assessment_invites")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (inviteUpdateErr) {
      return NextResponse.json({ error: inviteUpdateErr.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      result: {
        selfResult,
        othersResult,
        predominantSelf,
        predominantOthers,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro ao enviar questionario.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
