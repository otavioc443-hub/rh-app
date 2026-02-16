import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type FeedbackCycle = {
  id: string;
  name: string;
  collect_start: string;
  collect_end: string;
  release_start: string;
  release_end: string;
  active: boolean;
  created_at: string;
  created_by: string | null;
};

export async function GET() {
  const guard = await requireRoles(["colaborador", "coordenador", "rh", "admin", "gestor"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await supabaseAdmin
    .from("feedback_cycles")
    .select("id,name,collect_start,collect_end,release_start,release_end,active,created_at,created_by")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<FeedbackCycle>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const now = Date.now();
  const collectOpen = !!data && now >= Date.parse(data.collect_start) && now <= Date.parse(data.collect_end);
  const releaseOpen = !!data && now >= Date.parse(data.release_start) && now <= Date.parse(data.release_end);

  return NextResponse.json({ ok: true, cycle: data, collectOpen, releaseOpen });
}

export async function PUT(req: Request) {
  const guard = await requireRoles(["rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as Partial<FeedbackCycle>;
    const name = String(body.name ?? "").trim();
    const collectStart = String(body.collect_start ?? "");
    const collectEnd = String(body.collect_end ?? "");
    const releaseStart = String(body.release_start ?? "");
    const releaseEnd = String(body.release_end ?? "");

    if (!name || !collectStart || !collectEnd || !releaseStart || !releaseEnd) {
      return NextResponse.json({ error: "Campos obrigatorios ausentes." }, { status: 400 });
    }

    const { error: disableErr } = await supabaseAdmin
      .from("feedback_cycles")
      .update({ active: false })
      .eq("active", true);
    if (disableErr) return NextResponse.json({ error: disableErr.message }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("feedback_cycles")
      .insert({
        name,
        collect_start: collectStart,
        collect_end: collectEnd,
        release_start: releaseStart,
        release_end: releaseEnd,
        active: true,
        created_by: guard.userId,
      })
      .select("id,name,collect_start,collect_end,release_start,release_end,active,created_at,created_by")
      .single<FeedbackCycle>();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, cycle: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

