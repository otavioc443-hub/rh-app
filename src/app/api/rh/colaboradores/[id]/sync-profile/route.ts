import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, status: 401 as const };
    return { user: data.user, status: 200 as const };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const) };
}

function cleanEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isMissingColumnError(message: string | null | undefined) {
  const text = (message ?? "").toLowerCase();
  return text.includes("schema cache") || text.includes("could not find") || text.includes("column") || text.includes("does not exist");
}

async function findAuthUserIdByEmail(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return null;
    const user = data.users.find((item) => cleanEmail(item.email) === email);
    if (user) return user.id;
    if (data.users.length < 100) return null;
  }
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id do colaborador e obrigatorio" }, { status: 400 });
    }

    const requester = await getRequesterUser(req);
    const user = requester.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null; active: boolean | null }>();

    if (profErr || !prof?.active) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    if (!(prof.role === "rh" || prof.role === "admin")) {
      return NextResponse.json({ error: "Apenas RH/Admin" }, { status: 403 });
    }

    const body = (await req.json()) as {
      company_id?: string | null;
      department_id?: string | null;
    };
    const companyId = typeof body.company_id === "string" && body.company_id.trim() ? body.company_id.trim() : null;
    const departmentId =
      typeof body.department_id === "string" && body.department_id.trim() ? body.department_id.trim() : null;

    const { data: colab, error: colabErr } = await supabaseAdmin
      .from("colaboradores")
      .select("id,user_id,email,email_empresarial,email_pessoal,nome")
      .eq("id", id)
      .maybeSingle<{
        id: string;
        user_id: string | null;
        email: string | null;
        email_empresarial: string | null;
        email_pessoal: string | null;
        nome: string | null;
      }>();

    if (colabErr || !colab) return NextResponse.json({ error: "Colaborador nao encontrado" }, { status: 404 });

    const candidateEmails = Array.from(
      new Set([cleanEmail(colab.email), cleanEmail(colab.email_empresarial), cleanEmail(colab.email_pessoal)].filter(Boolean))
    );
    let profileUserId: string | null = null;

    for (const email of candidateEmails) {
      const { data: profileByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle<{ id: string }>();
      if (profileByEmail?.id) {
        profileUserId = profileByEmail.id;
        break;
      }
    }

    if (!profileUserId) {
      for (const email of candidateEmails) {
        profileUserId = await findAuthUserIdByEmail(email);
        if (profileUserId) break;
      }
    }

    profileUserId = profileUserId ?? colab.user_id;

    if (!profileUserId) {
      return NextResponse.json({
        error:
          "Nao encontrei um perfil de acesso para este colaborador. Envie ou reenvie o convite de acesso antes de vincular a empresa ao perfil.",
        synced: false,
      }, { status: 409 });
    }

    if (profileUserId !== colab.user_id) {
      await supabaseAdmin.from("colaboradores").update({ user_id: profileUserId }).eq("id", colab.id);
    }

    const primaryEmail = candidateEmails[0] || null;
    const { data: existingProfile, error: existingProfileErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", profileUserId)
      .maybeSingle<{ id: string }>();
    if (existingProfileErr) return NextResponse.json({ error: existingProfileErr.message }, { status: 400 });

    const profilePayload = {
      id: profileUserId,
      full_name: colab.nome,
      email: primaryEmail,
      company_id: companyId,
      department_id: departmentId,
      active: true,
    };

    const profileRes = existingProfile
      ? await supabaseAdmin
          .from("profiles")
          .update({
            full_name: profilePayload.full_name,
            email: profilePayload.email,
            company_id: profilePayload.company_id,
            department_id: profilePayload.department_id,
            active: profilePayload.active,
          })
          .eq("id", profileUserId)
      : await supabaseAdmin.from("profiles").insert({
          ...profilePayload,
          role: "colaborador",
        });

    if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 400 });

    const { error: colabUpdateErr } = await supabaseAdmin
      .from("colaboradores")
      .update({
        user_id: profileUserId,
        company_id: companyId,
        department_id: departmentId,
      })
      .eq("id", colab.id);

    if (colabUpdateErr) {
      if (!isMissingColumnError(colabUpdateErr.message)) {
        return NextResponse.json({ error: colabUpdateErr.message }, { status: 400 });
      }

      const { error: userIdOnlyErr } = await supabaseAdmin
        .from("colaboradores")
        .update({ user_id: profileUserId })
        .eq("id", colab.id);

      if (userIdOnlyErr) return NextResponse.json({ error: userIdOnlyErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, synced: true, user_id: profileUserId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
