import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type AssessmentRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  collaborator_id: string | null;
  predominant_self: string[] | null;
  predominant_others: string[] | null;
  self_result: Array<{ key: string; label: string; percent: number }> | null;
  others_result: Array<{ key: string; label: string; percent: number }> | null;
};

function normalizeName(value: string | null | undefined) {
  const name = String(value ?? "").trim();
  if (!name || name.includes("@")) return null;
  return name;
}

export async function GET() {
  const guard = await requireRoles(["rh", "admin"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { data, error } = await supabaseAdmin
    .from("behavior_assessments")
    .select("id,created_at,user_id,collaborator_id,predominant_self,predominant_others,self_result,others_result")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data ?? []) as AssessmentRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))) as string[];
  const collaboratorIds = Array.from(new Set(rows.map((row) => row.collaborator_id).filter(Boolean))) as string[];

  const [profileRes, collaboratorRes] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("profiles").select("id,full_name,email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    collaboratorIds.length
      ? supabaseAdmin.from("colaboradores").select("id,nome,email,user_id").in("id", collaboratorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profileRes.error) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 400 });
  }
  if (collaboratorRes.error) {
    return NextResponse.json({ error: collaboratorRes.error.message }, { status: 400 });
  }

  const profileById = new Map(
    ((profileRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((row) => [
      row.id,
      row,
    ])
  );
  const collaboratorById = new Map(
    ((collaboratorRes.data ?? []) as Array<{ id: string; nome: string | null; email: string | null; user_id: string | null }>).map((row) => [
      row.id,
      row,
    ])
  );

  const axisCounts = new Map<string, number>();
  const demandCounts = new Map<string, number>();
  const gapCounts = new Map<string, number>();

  const assessmentRows = rows.map((row) => {
    const collaborator = row.collaborator_id ? collaboratorById.get(row.collaborator_id) : null;
    const profile = row.user_id ? profileById.get(row.user_id) : collaborator?.user_id ? profileById.get(collaborator.user_id) : null;

    const collaboratorName =
      normalizeName(collaborator?.nome) ??
      normalizeName(profile?.full_name) ??
      collaborator?.email ??
      profile?.email ??
      "Colaborador sem nome";

    const predominant = (row.predominant_self ?? []).join(" + ") || "Leitura sem predominância clara";
    const demand = (row.predominant_others ?? []).join(" + ") || "Ambiente sem predominância clara";

    axisCounts.set(predominant, (axisCounts.get(predominant) ?? 0) + 1);
    demandCounts.set(demand, (demandCounts.get(demand) ?? 0) + 1);

    const currentByKey = new Map((row.self_result ?? []).map((item) => [item.key, item.percent]));
    const envByKey = new Map((row.others_result ?? []).map((item) => [item.key, item.percent]));
    let topGapLabel = "Sem gap relevante";
    let topGapValue = 0;

    for (const item of row.self_result ?? []) {
      const envPercent = envByKey.get(item.key) ?? 0;
      const diff = Math.abs(envPercent - item.percent);
      if (diff > topGapValue) {
        topGapValue = diff;
        topGapLabel = item.label;
      }
    }

    gapCounts.set(topGapLabel, (gapCounts.get(topGapLabel) ?? 0) + 1);

    return {
      id: row.id,
      collaborator_name: collaboratorName,
      created_at: row.created_at,
      predominant,
      demand,
      top_gap_label: topGapLabel,
      top_gap_value: Number(topGapValue.toFixed(2)),
      self_result: row.self_result ?? [],
      others_result: row.others_result ?? [],
    };
  });

  const topAxis = Array.from(axisCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
  const topDemand = Array.from(demandCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
  const topGaps = Array.from(gapCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return NextResponse.json({
    ok: true,
    summary: {
      total_assessments: assessmentRows.length,
      top_axis: topAxis[0]?.label ?? null,
      top_demand: topDemand[0]?.label ?? null,
      top_gap: topGaps[0]?.label ?? null,
    },
    top_axis: topAxis,
    top_demand: topDemand,
    top_gaps: topGaps,
    rows: assessmentRows,
  });
}
