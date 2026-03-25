import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isRouteHidden } from "@/lib/featureVisibility";

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
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/ceo" || pathname.startsWith("/ceo/");
}
function needsDiretoria(pathname: string) {
  return pathname === "/diretoria" || pathname.startsWith("/diretoria/");
}
function needsRH(pathname: string) {
  return pathname === "/rh" || pathname.startsWith("/rh/");
}
function needsOrganograma(pathname: string) {
  return pathname === "/institucional/organograma" || pathname.startsWith("/institucional/organograma/");
}
function needsGestorLms(pathname: string) {
  return pathname === "/gestor/lms/equipe" || pathname.startsWith("/gestor/lms/equipe/");
}

function shouldSkipFeatureVisibility(pathname: string) {
  return pathname === "/unauthorized" || pathname === "/admin/funcionalidades";
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

  // Sem user SSR: nao bloqueamos aqui.
  // A autenticacao do portal e validada no cliente pelo PortalShell/useUserRole.
  // Isso evita loop quando a sessao esta em sessionStorage no browser e nao em cookie SSR.
  if (!user) {
    return res;
  }

  // ✅ checa role apenas quando necessário
  if (needsRH(pathname) || needsAdmin(pathname) || needsDiretoria(pathname) || needsOrganograma(pathname) || needsGestorLms(pathname)) {
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

    let role = prof.role as string | null;
    try {
      const { data: currentRole, error: currentRoleErr } = await supabase.rpc("current_role");
      if (!currentRoleErr && typeof currentRole === "string" && currentRole.trim()) {
        role = currentRole.trim().toLowerCase();
      }
    } catch {
      // fallback silencioso para a role do profile
    }

    if (needsAdmin(pathname) && role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }

    if (needsDiretoria(pathname) && !(role === "diretoria" || role === "admin")) {
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

    if (needsGestorLms(pathname) && !(role === "gestor" || role === "admin")) {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  }

  // ✅ IMPORTANTÍSSIMO: retornar o res (com cookies atualizados)
  if (!shouldSkipFeatureVisibility(pathname)) {
    const { data: hiddenFeatures, error: hiddenError } = await supabase
      .from("portal_feature_visibility")
      .select("route_path")
      .eq("hidden", true);

    if (!hiddenError) {
      const hiddenRoutes = new Set<string>();
      for (const row of hiddenFeatures ?? []) {
        const route = typeof row.route_path === "string" ? row.route_path.trim() : "";
        if (route) hiddenRoutes.add(route);
      }

      if (isRouteHidden(pathname, hiddenRoutes)) {
        const url = req.nextUrl.clone();
        url.pathname = "/unauthorized";
        return NextResponse.redirect(url);
      }
    }
  }

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
