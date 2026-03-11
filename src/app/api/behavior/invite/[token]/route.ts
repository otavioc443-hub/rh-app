import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isExpired(iso: string | null) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return time < Date.now();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token?.trim()) {
      return NextResponse.json({ error: "Token invalido." }, { status: 400 });
    }

    const { data: invite, error } = await supabaseAdmin
      .from("behavior_assessment_invites")
      .select("id,collaborator_id,email,status,expires_at,completed_at")
      .eq("token", token)
      .maybeSingle<{
        id: string;
        collaborator_id: string | null;
        email: string;
        status: "pending" | "completed" | "expired" | "cancelled";
        expires_at: string | null;
        completed_at: string | null;
      }>();

    if (error || !invite) {
      return NextResponse.json({ error: "Convite nao encontrado." }, { status: 404 });
    }

    const expired = isExpired(invite.expires_at);
    if (expired && invite.status === "pending") {
      await supabaseAdmin
        .from("behavior_assessment_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      invite.status = "expired";
    }

    let collaboratorName: string | null = null;
    if (invite.collaborator_id) {
      const { data: c } = await supabaseAdmin
        .from("colaboradores")
        .select("nome")
        .eq("id", invite.collaborator_id)
        .maybeSingle<{ nome: string | null }>();
      collaboratorName = c?.nome ?? null;
    }

    return NextResponse.json({
      ok: true,
      invite: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        expires_at: invite.expires_at,
        completed_at: invite.completed_at,
      },
      collaboratorName,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro ao carregar convite.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
