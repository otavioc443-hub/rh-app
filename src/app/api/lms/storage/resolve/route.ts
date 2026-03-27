import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { parseStorageRef } from "@/lib/lms/utils";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "rh", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: "Acesso negado." }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const ref = String(searchParams.get("ref") ?? "").trim();
  const parsed = parseStorageRef(ref);
  if (!parsed) return NextResponse.json({ signedUrl: ref || null });

  const { data, error } = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data?.signedUrl ?? null });
}
