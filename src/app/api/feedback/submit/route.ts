import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type Scores = Record<string, number>;

type ActiveCycle = {
  id: string;
  collect_start: string;
  collect_end: string;
  release_start: string;
  release_end: string;
};

export async function POST(req: Request) {
  const guard = await requireRoles(["coordenador", "gestor", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as {
      target_user_id?: string;
      comment?: string;
      scores?: Scores;
      short_term_action?: string;
      details?: Record<string, unknown>;
      final_score?: number;
      status?: "draft" | "sent";
    };

    const targetUserId = String(body.target_user_id ?? "").trim();
    const comment = String(body.comment ?? "").trim();
    const scores = (body.scores ?? {}) as Scores;
    const shortTermAction = String(body.short_term_action ?? "").trim();
    const details = (body.details ?? {}) as Record<string, unknown>;
    const status = body.status === "draft" ? "draft" : "sent";

    if (!targetUserId || !comment) {
      return NextResponse.json({ error: "Colaborador e comentario sao obrigatorios." }, { status: 400 });
    }

    const { data: cycle, error: cycleErr } = await supabaseAdmin
      .from("feedback_cycles")
      .select("id,collect_start,collect_end,release_start,release_end")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ActiveCycle>();

    if (cycleErr) return NextResponse.json({ error: cycleErr.message }, { status: 400 });
    if (!cycle) return NextResponse.json({ error: "Nenhum ciclo ativo configurado pelo RH." }, { status: 400 });

    const now = Date.now();
    const isCollectOpen = now >= Date.parse(cycle.collect_start) && now <= Date.parse(cycle.collect_end);
    if (!isCollectOpen) {
      return NextResponse.json({ error: "Fora do periodo de coleta de feedback." }, { status: 400 });
    }

    const { data: targetProfile, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("id,email,active,role,company_id,department_id,manager_id")
      .eq("id", targetUserId)
      .maybeSingle<{
        id: string;
        email: string | null;
        active: boolean | null;
        role: string | null;
        company_id: string | null;
        department_id: string | null;
        manager_id: string | null;
      }>();
    if (targetErr || !targetProfile?.active) {
      return NextResponse.json({ error: "Colaborador alvo invalido." }, { status: 400 });
    }

    if (guard.role === "coordenador") {
      if (targetProfile.role !== "colaborador") {
        return NextResponse.json({ error: "Coordenador pode avaliar apenas colaboradores." }, { status: 403 });
      }
      const isDirectReport = targetProfile.manager_id === guard.userId;
      const isSameDepartment = guard.departmentId && targetProfile.department_id === guard.departmentId;
      if (!isDirectReport && !isSameDepartment) {
        return NextResponse.json(
          { error: "Coordenador pode avaliar apenas subordinados diretos ou do mesmo departamento." },
          { status: 403 }
        );
      }
    }

    if (guard.role === "gestor") {
      if (targetProfile.role !== "coordenador") {
        return NextResponse.json({ error: "Gestor pode avaliar apenas coordenadores." }, { status: 403 });
      }
      const isDirectReport = targetProfile.manager_id === guard.userId;
      const isSameCompany = guard.companyId && targetProfile.company_id === guard.companyId;
      if (!isDirectReport && !isSameCompany) {
        return NextResponse.json(
          { error: "Gestor pode avaliar apenas subordinados diretos ou da mesma empresa." },
          { status: 403 }
        );
      }
    }

    // score final e classificacao (escopo)
    let finalScore = Number(body.final_score);
    if (!Number.isFinite(finalScore)) {
      const values = Object.values(scores).filter((n) => Number.isFinite(Number(n))).map(Number);
      finalScore = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) * 2 : 0; // 1..5 -> 0..10
    }
    if (finalScore < 0) finalScore = 0;
    if (finalScore > 10) finalScore = 10;

    const finalClassification =
      finalScore >= 9 ? "Destaque" : finalScore >= 7 ? "Bom desempenho" : finalScore >= 5 ? "Atencao" : "Critico";

    const { error: insertErr } = await supabaseAdmin.from("feedbacks").insert({
      user_id: guard.userId,
      user_email: guard.email,
      target_user_id: targetUserId,
      evaluator_user_id: guard.userId,
      source_role: guard.role,
      cycle_id: cycle.id,
      scores,
      comment,
      details_json: details,
      final_score: finalScore,
      final_classification: finalClassification,
      status,
      released_to_collaborator: false,
      created_at: new Date().toISOString(),
    });

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });

    if (status === "sent") {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 30);

      // Retroalimenta PDI de curto prazo automaticamente
      const pdiGoal = String(details?.pdi_goal ?? "").trim();
      const pdiTitle = pdiGoal || "PDI curto prazo: melhoria a partir de feedback";
      const pdiAction = shortTermAction || String(details?.pdi_action ?? "").trim() || comment.slice(0, 260);
      const pdiDeadline = String(details?.pdi_deadline ?? "").trim();
      const { error: pdiErr } = await supabaseAdmin.from("pdi_items").insert({
        user_id: targetUserId,
        title: pdiTitle,
        action: pdiAction,
        target_date: pdiDeadline || targetDate.toISOString().slice(0, 10),
        status: "planejado",
      });
      if (pdiErr) {
        return NextResponse.json({ error: `Feedback salvo, mas PDI falhou: ${pdiErr.message}` }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, final_score: finalScore, final_classification: finalClassification });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
