import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSupabase } from "@/lib/server/supabaseServer";

type InputPlanItem = {
  horizon?: string;
  title?: string;
  text?: string;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const supabaseServer = await getServerSupabase();
  const { data: userRes, error: userErr } = await supabaseServer.auth.getUser();
  const user = userRes?.user;

  if (userErr || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      plan?: InputPlanItem[];
      focus?: string;
      strength?: string;
    };

    const plan = Array.isArray(body.plan) ? body.plan : [];
    const focus = normalizeText(body.focus) || "Desenvolvimento prioritário";
    const strength = normalizeText(body.strength) || "Competência principal";

    if (!plan.length) {
      return NextResponse.json({ error: "Plano sugerido não informado." }, { status: 400 });
    }

    const normalizedItems = plan
      .map((item) => {
        const horizon = normalizeText(item.horizon);
        const title = normalizeText(item.title);
        const text = normalizeText(item.text);
        if (!title) return null;
        return {
          user_id: user.id,
          title: horizon ? `${horizon} • ${title}` : title,
          action: text || `Usar ${strength} como alavanca e acompanhar evolução em ${focus}.`,
          status: "planejado",
        };
      })
      .filter(Boolean) as Array<{
        user_id: string;
        title: string;
        action: string;
        status: "planejado";
      }>;

    if (!normalizedItems.length) {
      return NextResponse.json({ error: "Nenhum item válido para criar no PDI." }, { status: 400 });
    }

    const titles = normalizedItems.map((item) => item.title);
    const { data: existingRows, error: existingErr } = await supabaseAdmin
      .from("pdi_items")
      .select("title")
      .eq("user_id", user.id)
      .in("title", titles);

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 400 });
    }

    const existingTitles = new Set(((existingRows ?? []) as Array<{ title: string | null }>).map((row) => row.title).filter(Boolean));
    const itemsToCreate = normalizedItems.filter((item) => !existingTitles.has(item.title));

    if (!itemsToCreate.length) {
      return NextResponse.json({ ok: true, created: 0 });
    }

    const { error: insertErr } = await supabaseAdmin.from("pdi_items").insert(itemsToCreate);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, created: itemsToCreate.length });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao gerar plano no PDI." },
      { status: 500 }
    );
  }
}
