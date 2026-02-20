import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "deliverable-documents";

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, status: 401 as const, token: null };
    return { user: data.user, status: 200 as const, token };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const), token: null };
}

async function getRequesterSupabase(req: Request, token: string | null): Promise<SupabaseClient> {
  if (token) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

function safeFileName(name: string) {
  const raw = (name || "").trim().slice(0, 140);
  if (!raw) return "arquivo";
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isAllowedMime(m: string) {
  return (
    m === "application/pdf" ||
    m === "application/msword" ||
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    m === "application/vnd.ms-excel" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    m === "image/png" ||
    m === "image/jpeg" ||
    m === "image/webp"
  );
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    const user = requester.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const form = await req.formData();
    const deliverableId = String(form.get("deliverable_id") ?? "").trim();
    const file = form.get("file");

    if (!deliverableId) return NextResponse.json({ error: "deliverable_id e obrigatorio" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo (file) e obrigatorio" }, { status: 400 });

    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) return NextResponse.json({ error: "Arquivo muito grande (max 20MB)" }, { status: 400 });
    if (!isAllowedMime(file.type)) return NextResponse.json({ error: "Tipo de arquivo nao suportado" }, { status: 400 });

    // Role/active efetivos via RPC (respeita a logica do app).
    let effectiveRole: string | null = null;
    let active = false;
    try {
      const supabaseUser = await getRequesterSupabase(req, requester.token);
      const [{ data: r, error: rErr }, { data: a, error: aErr }] = await Promise.all([
        supabaseUser.rpc("current_role"),
        supabaseUser.rpc("current_active"),
      ]);
      if (rErr || aErr) throw new Error(rErr?.message || aErr?.message || "rpc failed");
      effectiveRole = r ? String(r) : null;
      active = a === true;
    } catch {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .maybeSingle<{ role: string | null; active: boolean | null }>();
      effectiveRole = prof?.role ?? null;
      active = prof?.active === true;
    }

    if (!active) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    const { data: del, error: delErr } = await supabaseAdmin
      .from("project_deliverables")
      .select("id, project_id, assigned_to, status, submitted_by, submitted_at")
      .eq("id", deliverableId)
      .maybeSingle<{
        id: string;
        project_id: string;
        assigned_to: string | null;
        status: string;
        submitted_by: string | null;
        submitted_at: string | null;
      }>();
    if (delErr || !del) return NextResponse.json({ error: "Entregavel nao encontrado" }, { status: 404 });

    const projectId = del.project_id;

    const { data: extraAssignee } = await supabaseAdmin
      .from("project_deliverable_assignees")
      .select("id")
      .eq("deliverable_id", deliverableId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>();
    const isAdditionalAssignee = !!extraAssignee?.id;

    // Permissao:
    // - admin/rh: sempre
    // - colaborador: apenas se for o responsavel (assigned_to)
    // - gestor/coordenador: se for dono do projeto ou membro gestor/coordenador do projeto
    let allowed = false;

    if (effectiveRole === "admin" || effectiveRole === "rh") {
      allowed = true;
    } else if ((del.assigned_to && del.assigned_to === user.id) || isAdditionalAssignee) {
      allowed = true;
    } else if (effectiveRole === "gestor" || effectiveRole === "coordenador") {
      const [{ data: pr }, { data: pm }] = await Promise.all([
        supabaseAdmin.from("projects").select("owner_user_id").eq("id", projectId).maybeSingle<{ owner_user_id: string }>(),
        supabaseAdmin
          .from("project_members")
          .select("member_role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle<{ member_role: string }>(),
      ]);
      if (pr?.owner_user_id === user.id) allowed = true;
      if (pm?.member_role === "gestor" || pm?.member_role === "coordenador") allowed = true;
    }

    if (!allowed) return NextResponse.json({ error: "Sem permissao para enviar este documento" }, { status: 403 });

    if (
      effectiveRole === "colaborador" &&
      (del.assigned_to === user.id || isAdditionalAssignee) &&
      !["pending", "in_progress"].includes(del.status)
    ) {
      return NextResponse.json(
        { error: "Entregavel bloqueado para edicao. Aguarde reencaminhamento do coordenador." },
        { status: 400 }
      );
    }

    const baseName = safeFileName(file.name);
    const path = `${projectId}/${deliverableId}/${Date.now()}-${Math.random().toString(16).slice(2)}-${baseName}`;

    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    // Versionamento
    const { data: maxRow } = await supabaseAdmin
      .from("project_deliverable_files")
      .select("version")
      .eq("deliverable_id", deliverableId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<{ version: number }>();
    const nextVersion = (maxRow?.version ?? 0) + 1;

    await supabaseAdmin.from("project_deliverable_files").insert({
      deliverable_id: deliverableId,
      project_id: projectId,
      version: nextVersion,
      storage_bucket: BUCKET,
      storage_path: path,
      file_name: file.name || null,
      content_type: file.type || null,
      size_bytes: file.size || null,
      uploaded_by: user.id,
    });

    // Atualiza o entregavel com o ultimo arquivo enviado
    const collaboratorAutoSend = effectiveRole === "colaborador";
    await supabaseAdmin
      .from("project_deliverables")
      .update({
        document_path: path,
        document_file_name: file.name || null,
        document_content_type: file.type || null,
        document_size: file.size || null,
        status: collaboratorAutoSend ? del.status : "sent",
        submitted_by: collaboratorAutoSend ? del.submitted_by : user.id,
        submitted_at: collaboratorAutoSend ? del.submitted_at : new Date().toISOString(),
      })
      .eq("id", deliverableId);

    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signed.error) return NextResponse.json({ ok: true, path, version: nextVersion }, { status: 200 });

    return NextResponse.json({ ok: true, path, version: nextVersion, signedUrl: signed.data.signedUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
