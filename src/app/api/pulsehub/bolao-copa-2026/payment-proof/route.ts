import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "pulsehub-bolao";

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return null;
}

async function getAuthenticatedUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { user: null, error: "Não autenticado" };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user ?? null;
  if (error || !user) return { user: null, error: "Não autenticado" };
  return { user, error: null };
}

async function isRhOrAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role,active")
    .eq("id", userId)
    .maybeSingle<{ role: string | null; active: boolean | null }>();

  return data?.active === true && (data.role === "rh" || data.role === "admin");
}

export async function GET(req: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: error || "Não autenticado" }, { status: 401 });
    if (!(await isRhOrAdmin(user.id))) return NextResponse.json({ error: "Acesso restrito ao RH/Admin" }, { status: 403 });

    const url = new URL(req.url);
    const betId = String(url.searchParams.get("betId") ?? "").trim();
    if (!betId) return NextResponse.json({ error: "Aposta não informada" }, { status: 400 });

    const { data: bet, error: betErr } = await supabaseAdmin
      .from("pulsehub_bolao_copa_2026")
      .select("id,comprovante_url,comprovante_path")
      .eq("id", betId)
      .maybeSingle<{ id: string; comprovante_url: string | null; comprovante_path: string | null }>();

    if (betErr) return NextResponse.json({ error: betErr.message }, { status: 400 });
    if (!bet?.comprovante_path && !bet?.comprovante_url) {
      return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });
    }

    if (bet.comprovante_path) {
      const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(bet.comprovante_path, 60 * 10);
      if (signed.error || !signed.data?.signedUrl) {
        return NextResponse.json({ error: signed.error?.message || "Não foi possível abrir o comprovante" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, url: signed.data.signedUrl, path: bet.comprovante_path });
    }

    return NextResponse.json({ ok: true, url: bet.comprovante_url, path: null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user ?? null;
    if (userErr || !user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    const betId = String(form.get("betId") ?? "").trim();

    if (!betId) return NextResponse.json({ error: "Aposta não informada" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

    const { data: bet, error: betErr } = await supabaseAdmin
      .from("pulsehub_bolao_copa_2026")
      .select("id,user_id")
      .eq("id", betId)
      .maybeSingle<{ id: string; user_id: string | null }>();

    if (betErr) return NextResponse.json({ error: betErr.message }, { status: 400 });
    if (!bet || bet.user_id !== user.id) return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });

    const ext = extFromMime(file.type);
    if (!ext) return NextResponse.json({ error: "Envie PNG, JPG, WEBP ou PDF" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)" }, { status: 400 });

    const path = `comprovantes/${user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const upload = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 });

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data.publicUrl;

    const update = await supabaseAdmin
      .from("pulsehub_bolao_copa_2026")
      .update({
        comprovante_url: publicUrl,
        comprovante_path: path,
        payment_status: "aguardando_validacao",
      })
      .eq("id", betId)
      .eq("user_id", user.id)
      .select("id,comprovante_url,comprovante_path,payment_status")
      .single();

    if (update.error) return NextResponse.json({ error: update.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, publicUrl, path, paymentStatus: "aguardando_validacao" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
