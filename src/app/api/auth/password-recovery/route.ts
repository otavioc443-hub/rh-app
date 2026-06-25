import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalEmail } from "@/lib/server/mailer";

const PORTAL_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rh-app-seven.vercel.app").replace(/\/$/, "");

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function recoveryHtml(link: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">Redefinicao de senha</h2>
      <p>Voce solicitou a criacao de uma nova senha para acessar o Portal de RH.</p>
      <p>Este link expira em ate 10 minutos e deve ser usado apenas uma vez.</p>
      <p>
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#020617;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700">
          Definir nova senha
        </a>
      </p>
      <p style="font-size:12px;color:#64748b">Se voce nao solicitou esta redefinicao, ignore este e-mail.</p>
    </div>
  `;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown };
    const email = clean(body.email).toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail valido." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) {
      console.warn("Falha ao gerar link de redefinicao:", error.message);
      return NextResponse.json({ ok: true });
    }

    const properties = data.properties as { hashed_token?: string | null } | null;
    const tokenHash = clean(properties?.hashed_token);
    if (!tokenHash) {
      console.warn("Link de redefinicao sem hashed_token.");
      return NextResponse.json({ ok: true });
    }

    const recoveryUrl = `${PORTAL_ORIGIN}/set-password?flow=recovery&type=recovery&token_hash=${encodeURIComponent(tokenHash)}`;
    await sendPortalEmail({
      to: email,
      subject: "Redefinicao de senha - Portal de RH",
      html: recoveryHtml(recoveryUrl),
      text: `Voce solicitou a criacao de uma nova senha para acessar o Portal de RH.\n\nEste link expira em ate 10 minutos e deve ser usado apenas uma vez.\n\nAcesse: ${recoveryUrl}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar redefinicao de senha:", error);
    return NextResponse.json({ error: "Nao foi possivel enviar o link de redefinicao agora." }, { status: 500 });
  }
}
