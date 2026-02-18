import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/", "/auth/callback", "/set-password", "/unauthorized"];
type CookieOptions = Record<string, unknown>;

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true; // assets
  if (pathname.startsWith("/api")) return true; // APIs públicas/rotas do app
  return false;
}

function needsAdmin(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/diretoria" || pathname.startsWith("/diretoria/") || pathname === "/ceo" || pathname.startsWith("/ceo/");
}
function needsRH(pathname: string) {
  return pathname === "/rh" || pathname.startsWith("/rh/");
}
function needsOrganograma(pathname: string) {
  return pathname === "/institucional/organograma" || pathname.startsWith("/institucional/organograma/");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // libera páginas públicas
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ✅ response que vai carregar cookies atualizados
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // grava no response (fundamental!)
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  // ✅ pega user (o SSR enxerga a sessão via cookies)
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  // sem user => volta pro login
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // ✅ checa role apenas quando necessário
  if (needsRH(pathname) || needsAdmin(pathname) || needsOrganograma(pathname)) {
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !prof?.active) {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }

    const role = prof.role as string | null;

    if (needsAdmin(pathname) && role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }

    if (needsRH(pathname) && !(role === "rh" || role === "admin")) {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }

    if (needsOrganograma(pathname) && !(role === "gestor" || role === "financeiro" || role === "admin")) {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  // ✅ IMPORTANTÍSSIMO: retornar o res (com cookies atualizados)
  return res;
}

export const config = {
  matcher: [
    /*
      Protege tudo por padrão, exceto assets/_next.
      Se você tiver outras pastas públicas, adicione no isPublicPath.
    */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
