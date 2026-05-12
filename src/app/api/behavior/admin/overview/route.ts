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
    .limit(120);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data ?? []) as AssessmentRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))) as string[];
  const collaboratorIds = Array.from(new Set(rows.map((row) => row.collaborator_id).filter(Boolean))) as string[];

  const [profileRes, collaboratorRes] = await Promise.all([
    userIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("id,full_name,email,role,company_id,department_id")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    collaboratorIds.length
      ? supabaseAdmin
          .from("colaboradores")
          .select("id,nome,email,user_id,cargo")
          .in("id", collaboratorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profileRes.error) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 400 });
  }
  if (collaboratorRes.error) {
    return NextResponse.json({ error: collaboratorRes.error.message }, { status: 400 });
  }

  const profiles = (profileRes.data ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
    company_id: string | null;
    department_id: string | null;
  }>;
  const collaborators = (collaboratorRes.data ?? []) as Array<{
    id: string;
    nome: string | null;
    email: string | null;
    user_id: string | null;
    cargo: string | null;
  }>;

  const companyIds = Array.from(new Set(profiles.map((item) => item.company_id).filter(Boolean))) as string[];
  const departmentIds = Array.from(new Set(profiles.map((item) => item.department_id).filter(Boolean))) as string[];

  const [companiesRes, departmentsRes] = await Promise.all([
    companyIds.length
      ? supabaseAdmin.from("companies").select("id,name").in("id", companyIds)
      : Promise.resolve({ data: [], error: null }),
    departmentIds.length
      ? supabaseAdmin.from("departments").select("id,name").in("id", departmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (companiesRes.error) {
    return NextResponse.json({ error: companiesRes.error.message }, { status: 400 });
  }
  if (departmentsRes.error) {
    return NextResponse.json({ error: departmentsRes.error.message }, { status: 400 });
  }

  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const collaboratorById = new Map(collaborators.map((row) => [row.id, row]));
  const companyById = new Map(
    ((companiesRes.data ?? []) as Array<{ id: string; name: string | null }>).map((row) => [row.id, row.name ?? row.id])
  );
  const departmentById = new Map(
    ((departmentsRes.data ?? []) as Array<{ id: string; name: string | null }>).map((row) => [row.id, row.name ?? row.id])
  );

  const axisCounts = new Map<string, number>();
  const demandCounts = new Map<string, number>();
  const gapCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  const departmentCounts = new Map<string, number>();
  const jobTitleCounts = new Map<string, number>();
  const fitCounts = new Map<string, number>();

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
    const roleLabel = (profile?.role ?? "").trim() || "Sem papel";
    const companyName = profile?.company_id ? companyById.get(profile.company_id) ?? null : null;
    const departmentName = profile?.department_id ? departmentById.get(profile.department_id) ?? null : null;
    const jobTitle = (collaborator?.cargo ?? "").trim() || null;

    axisCounts.set(predominant, (axisCounts.get(predominant) ?? 0) + 1);
    demandCounts.set(demand, (demandCounts.get(demand) ?? 0) + 1);
    roleCounts.set(roleLabel, (roleCounts.get(roleLabel) ?? 0) + 1);
    if (departmentName) departmentCounts.set(departmentName, (departmentCounts.get(departmentName) ?? 0) + 1);
    if (jobTitle) jobTitleCounts.set(jobTitle, (jobTitleCounts.get(jobTitle) ?? 0) + 1);

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
    const fitSummary =
      topGapValue >= 18
        ? "Aderencia em atencao"
        : topGapValue >= 10
          ? "Aderencia moderada"
          : "Aderencia consistente";
    fitCounts.set(fitSummary, (fitCounts.get(fitSummary) ?? 0) + 1);

    return {
      id: row.id,
      collaborator_name: collaboratorName,
      created_at: row.created_at,
      predominant,
      demand,
      top_gap_label: topGapLabel,
      top_gap_value: Number(topGapValue.toFixed(2)),
      role: roleLabel,
      department_name: departmentName,
      company_name: companyName,
      job_title: jobTitle,
      fit_summary: fitSummary,
    };
  });

  const sortTop = (input: Map<string, number>, limit = 5) =>
    Array.from(input.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, count]) => ({ label, count }));

  const topAxis = sortTop(axisCounts);
  const topDemand = sortTop(demandCounts);
  const topGaps = sortTop(gapCounts);
  const topRoles = sortTop(roleCounts);
  const topDepartments = sortTop(departmentCounts);
  const topJobTitles = sortTop(jobTitleCounts);
  const fitBuckets = sortTop(fitCounts, 3);

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
    top_roles: topRoles,
    top_departments: topDepartments,
    top_job_titles: topJobTitles,
    fit_buckets: fitBuckets,
    rows: assessmentRows,
  });
}
