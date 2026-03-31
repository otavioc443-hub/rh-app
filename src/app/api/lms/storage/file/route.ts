import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { parseStorageRef } from "@/lib/lms/utils";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: "Acesso negado." }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const ref = String(searchParams.get("ref") ?? "").trim();
  const parsed = parseStorageRef(ref);
  if (!parsed) return NextResponse.json({ error: "Arquivo invalido." }, { status: 400 });

  const signed = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: signed.error?.message ?? "Nao foi possivel abrir o arquivo." }, { status: 500 });
  }

  const response = NextResponse.redirect(signed.data.signedUrl, 307);
  response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=600");
  return response;
}
