import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "finance-remittance-documents";
type Role = "admin" | "rh" | "financeiro" | "gestor" | "coordenador" | "colaborador" | "pd";

async function getRequester(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { userId: null as string | null, role: null as Role | null, status: 401 as const };

  const userRes = await supabaseAdmin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) return { userId: null as string | null, role: null as Role | null, status: 401 as const };
  const userId = userRes.data.user.id;
  const roleRes = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle<{ role: Role }>();
  return { userId, role: roleRes.data?.role ?? null, status: 200 as const };
}

function safeName(name: string) {
  const raw = (name || "").trim().slice(0, 140);
  if (!raw) return "arquivo";
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function detectKind(contentType: string) {
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("image/")) return "image";
  return "other";
}

export async function POST(req: Request) {
  try {
    const requester = await getRequester(req);
    if (!requester.userId) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });
    if (requester.role !== "admin" && requester.role !== "financeiro" && requester.role !== "rh") {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const form = await req.formData();
    const remittanceId = String(form.get("remittance_id") ?? "").trim();
    const file = form.get("file");
    if (!remittanceId) return NextResponse.json({ error: "remittance_id e obrigatorio" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo (file) e obrigatorio" }, { status: 400 });

    const allowed =
      file.type === "application/pdf" ||
      file.type.startsWith("image/");
    if (!allowed) return NextResponse.json({ error: "Tipo nao suportado (PDF/Imagem)" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (max 10MB)" }, { status: 400 });

    const remRes = await supabaseAdmin.from("collaborator_invoice_remittances").select("id").eq("id", remittanceId).maybeSingle<{ id: string }>();
    if (remRes.error || !remRes.data) return NextResponse.json({ error: "Remessa nao encontrada" }, { status: 404 });

    const path = `remittance/${remittanceId}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName(file.name)}`;
    const uploadRes = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (uploadRes.error) return NextResponse.json({ error: uploadRes.error.message }, { status: 400 });

    const insRes = await supabaseAdmin.from("collaborator_invoice_remittance_files").insert({
      remittance_id: remittanceId,
      uploaded_by: requester.userId,
      file_kind: detectKind(file.type),
      storage_bucket: BUCKET,
      storage_path: path,
      file_name: file.name || null,
      content_type: file.type || null,
      size_bytes: file.size || null,
    });
    if (insRes.error) return NextResponse.json({ error: insRes.error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
