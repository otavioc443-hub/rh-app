import { NextResponse } from "next/server";
import { getPulseHubSharePost } from "@/lib/pulsehubShare";

type ShareRouteContext = {
  params: Promise<{ postId: string }>;
};

const FALLBACK_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rh-app-seven.vercel.app").replace(/\/$/, "");

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function originFromRequest(request: Request) {
  try {
    return new URL(request.url).origin || FALLBACK_ORIGIN;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

function isPreviewCrawler(request: Request) {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
  return [
    "bot",
    "crawler",
    "facebookexternalhit",
    "facebot",
    "linkedinbot",
    "twitterbot",
    "slackbot",
    "telegrambot",
    "whatsapp",
    "discordbot",
    "skypeuripreview",
  ].some((token) => userAgent.includes(token));
}

export async function GET(request: Request, { params }: ShareRouteContext) {
  const { postId } = await params;
  const origin = originFromRequest(request);
  const post = await getPulseHubSharePost(postId);
  const title = post?.title || "Publicação PulseHub";
  const description = post?.description || "Acesse o link para ver o comunicado completo no Portal de RH.";
  const shareUrl = `${origin}/share/pulsehub/${postId}?v=7`;
  const loginUrl = `${origin}/?next=${encodeURIComponent(`/institucional/rede-social?tab=inicio#post-${postId}`)}`;
  const imageUrl = `${origin}/share/pulsehub/${postId}/image.png?v=7`;
  const publisher = post?.publisher || "Portal de RH";

  if (!isPreviewCrawler(request)) {
    return NextResponse.redirect(loginUrl);
  }

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(shareUrl)}" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Portal de RH" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <style>
    body{margin:0;background:#0f172a;color:#0f172a;font-family:Arial,Helvetica,sans-serif}
    main{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px}
    section{max-width:720px;background:#fff;border-radius:28px;padding:32px;box-shadow:0 28px 80px rgba(0,0,0,.32)}
    .brand{display:flex;align-items:center;gap:14px;margin-bottom:22px}
    .logo{height:48px;width:48px;border-radius:16px;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900}
    .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;font-weight:800}
    h1{margin:0;font-size:30px;line-height:1.12}
    p{font-size:16px;line-height:1.65;color:#475569}
    a{display:inline-flex;margin-top:12px;border-radius:16px;background:#0f172a;color:#fff;text-decoration:none;padding:12px 16px;font-weight:800}
  </style>
</head>
<body>
  <main>
    <section>
      <div class="brand"><div class="logo">RH</div><div><div class="eyebrow">PulseHub</div><strong>${escapeHtml(publisher)}</strong></div></div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <a href="${escapeHtml(loginUrl)}">Acessar comunicado completo</a>
    </section>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
