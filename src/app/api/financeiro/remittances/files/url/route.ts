import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "admin" | "rh" | "financeiro" | "gestor" | "coordenador" | "colaborador" | "pd";

async function getRequester(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { role: null as Role | null, status: 401 as const };

  const userRes = await supabaseAdmin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) return { role: null as Role | null, status: 401 as const };
  const roleRes = await supabaseAdmin.from("profiles").select("role").eq("id", userRes.data.user.id).maybeSingle<{ role: Role }>();
  return { role: roleRes.data?.role ?? null, status: 200 as const };
}

export async function GET(req: Request) {
  try {
    const requester = await getRequester(req);
    if (requester.status !== 200) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });
    if (requester.role !== "admin" && requester.role !== "financeiro" && requester.role !== "rh") {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const url = new URL(req.url);
    const fileId = url.searchParams.get("file_id")?.trim() ?? "";
    if (!fileId) return NextResponse.json({ error: "file_id e obrigatorio" }, { status: 400 });

    const fileRes = await supabaseAdmin
      .from("collaborator_invoice_remittance_files")
      .select("storage_bucket,storage_path")
      .eq("id", fileId)
      .maybeSingle<{ storage_bucket: string; storage_path: string }>();
    if (fileRes.error || !fileRes.data) return NextResponse.json({ error: "Arquivo nao encontrado" }, { status: 404 });

    const signed = await supabaseAdmin.storage
      .from(fileRes.data.storage_bucket)
      .createSignedUrl(fileRes.data.storage_path, 60 * 5);
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ error: signed.error?.message || "Erro ao assinar URL" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, signedUrl: signed.data.signedUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
