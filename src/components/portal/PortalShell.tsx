"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  clearRecentLoginMarker,
  forceClientLogout,
  hasRecentLoginMarker,
  supabase,
} from "@/lib/supabaseClient";
import Sidebar from "@/components/portal/Sidebar";
import NotificationBell from "@/components/portal/NotificationBell";
import { resolvePortalAvatarUrl } from "@/lib/avatarUrl";
import { isRouteHidden } from "@/lib/featureVisibility";

type Role = "colaborador" | "coordenador" | "gestor" | "diretoria" | "rh" | "financeiro" | "pd" | "admin";

const ROLE_SET = new Set<Role>(["colaborador", "coordenador", "gestor", "diretoria", "rh", "financeiro", "pd", "admin"]);
function coerceRole(v: unknown): Role | null {
  if (!v) return null;
  const raw = String(v).trim().toLowerCase();
  const s = raw as Role;
  return ROLE_SET.has(s) ? s : null;
}

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
};

type Department = {
  id: string;
  name: string;
};

type Profile = {
  role: Role | null;
  active: boolean | null;
  company_id: string | null;
  department_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type HiddenRouteRow = {
  route_path: string | null;
  hidden: boolean | null;
};

type ColaboradorName = {
  nome: string | null;
  cargo: string | null;
};

type PortalShellCache = {
  role: Role | null;
  company: Company | null;
  department: Department | null;
  fullName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  hiddenRoutes: string[];
};

type DraftFieldSnapshot = {
  key: string;
  tag: "INPUT" | "TEXTAREA" | "SELECT";
  type?: string;
  value?: string;
  checked?: boolean;
};

function withTimeout<T>(p: Promise<T>, ms = 7000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function getScrollStorageKey(pathname: string) {
  return `portal-scroll:${pathname}`;
}

function getDraftStorageKey(pathname: string) {
  return `portal-draft:${pathname}`;
}

const PORTAL_SHELL_CACHE_KEY = "portal-shell-cache";

function readPortalShellCache(): PortalShellCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PORTAL_SHELL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalShellCache;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePortalShellCache(cache: PortalShellCache) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PORTAL_SHELL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // noop
  }
}

function getFieldDraftKey(element: Element, index: number) {
  const node = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  return node.name || node.id || `${node.tagName}:${node.getAttribute("type") ?? "text"}:${index}`;
}

function collectDraftSnapshot() {
  if (typeof document === "undefined") return [] as DraftFieldSnapshot[];

  const fields = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select"
    )
  );

  const snapshot: DraftFieldSnapshot[] = [];

  fields.forEach((field, index) => {
    const tag = field.tagName as DraftFieldSnapshot["tag"];
    if (tag === "INPUT") {
      const type = (field as HTMLInputElement).type?.toLowerCase() || "text";
      if (["password", "file", "hidden", "submit", "button", "reset"].includes(type)) return;
      if ((field as HTMLInputElement).disabled) return;
      if (type === "checkbox" || type === "radio") {
        snapshot.push({
          key: getFieldDraftKey(field, index),
          tag,
          type,
          checked: (field as HTMLInputElement).checked,
        });
        return;
      }
      snapshot.push({ key: getFieldDraftKey(field, index), tag, type, value: field.value });
      return;
    }

    if (field.disabled) return;
    snapshot.push({ key: getFieldDraftKey(field, index), tag, value: field.value });
  });

  return snapshot;
}

function persistDraftSnapshot(pathname: string) {
  if (typeof window === "undefined" || !pathname) return;
  try {
    const snapshot = collectDraftSnapshot();
    window.sessionStorage.setItem(getDraftStorageKey(pathname), JSON.stringify(snapshot));
  } catch {
    // noop
  }
}

function restoreDraftSnapshot(pathname: string) {
  if (typeof window === "undefined" || typeof document === "undefined" || !pathname) return;

  try {
    const raw = window.sessionStorage.getItem(getDraftStorageKey(pathname));
    if (!raw) return;

    const snapshot = JSON.parse(raw) as DraftFieldSnapshot[];
    if (!Array.isArray(snapshot) || !snapshot.length) return;

    const fields = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select"
      )
    );

    for (const [index, field] of fields.entries()) {
      const key = getFieldDraftKey(field, index);
      const saved = snapshot.find((item) => item.key === key);
      if (!saved) continue;

      if (saved.tag === "INPUT") {
        const input = field as HTMLInputElement;
        const type = input.type?.toLowerCase() || "text";
        if (["password", "file", "hidden", "submit", "button", "reset"].includes(type)) continue;
        if (type === "checkbox" || type === "radio") {
          if (typeof saved.checked === "boolean" && input.checked !== saved.checked) {
            input.checked = saved.checked;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
          continue;
        }
        if (typeof saved.value === "string" && input.value !== saved.value) {
          input.value = saved.value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        continue;
      }

      if (typeof saved.value === "string" && field.value !== saved.value) {
        field.value = saved.value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  } catch {
    // noop
  }
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [debugErr, setDebugErr] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hiddenRoutes, setHiddenRoutes] = useState<Set<string>>(new Set());
  const [hiddenRoutesLoaded, setHiddenRoutesLoaded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const inFlight = useRef(false);
  const alive = useRef(true);
  const hydratedFromCache = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("portal_sidebar_collapsed");
      setSidebarCollapsed(saved === "1");
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("portal_sidebar_collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // noop
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const cached = readPortalShellCache();
    if (!cached) return;

    hydratedFromCache.current = true;
    setRole(cached.role);
    setCompany(cached.company);
    setDepartment(cached.department);
    setFullName(cached.fullName);
    setJobTitle(cached.jobTitle);
    setAvatarUrl(cached.avatarUrl);
    setHiddenRoutes(new Set(cached.hiddenRoutes));
    setHiddenRoutesLoaded(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;

    async function safeRedirectToLogin() {
      if (window.location.pathname === "/") return;
      router.replace("/?redirectedFrom=%2Fhome");
    }

    async function boot({
      resetVisibilityState = true,
      silent = false,
    }: { resetVisibilityState?: boolean; silent?: boolean } = {}) {
      if (inFlight.current) return;
      inFlight.current = true;

      if (!silent) {
        setLoading(true);
      }
      setFatalError(null);
      setDebugErr(null);
      if (resetVisibilityState) {
        setHiddenRoutesLoaded(false);
      }

      try {
        let { data: sessRes, error: sessErr } = await withTimeout(supabase.auth.getSession(), 7000);

        if (!alive.current) return;

        if ((!sessRes?.session?.user || sessErr) && hasRecentLoginMarker()) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const retry = await withTimeout(supabase.auth.getSession(), 7000);
          sessRes = retry.data;
          sessErr = retry.error;
        }

        if (sessErr) {
          await safeRedirectToLogin();
          return;
        }

        const userId = sessRes?.session?.user?.id ?? null;
        const userEmail = sessRes?.session?.user?.email ?? null;
        if (!userId) {
          await safeRedirectToLogin();
          return;
        }

        clearRecentLoginMarker();

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role, active, company_id, department_id, full_name, avatar_url")
          .eq("id", userId)
          .maybeSingle<Profile>();

        if (!alive.current) return;

        if (profileErr) {
          setFatalError("Não foi possível ler profiles. Verifique RLS/Policy/GRANT ou cadastro.");
          setDebugErr(profileErr.message);
          return;
        }

        if (!profile) {
          setFatalError("Perfil não encontrado na tabela profiles para este usuário.");
          setDebugErr(`Nenhuma linha encontrada para id=${userId}`);
          return;
        }

        if (profile.active === false) {
          setFatalError("Usuário inativo. Procure o administrador do sistema.");
          return;
        }

        // Role efetiva: preferimos a funcao do banco (current_role),
        // pois ela pode considerar mapeamento por cargo (cargos.portal_role).
        let r: Role | null = coerceRole(profile.role);
        try {
          const { data: cr, error: crErr } = await supabase.rpc("current_role");
          if (!crErr) r = coerceRole(cr) ?? r;
        } catch {
          // fallback silencioso: mantem a role do profile
        }

        if (!r) {
          setFatalError("Perfil sem função (role). Defina role = colaborador/coordenador/gestor/diretoria/rh/financeiro/pd/admin.");
          return;
        }

        let resolvedFullName = profile.full_name?.trim() ?? "";
        let resolvedJobTitle: string | null = null;

        if (userEmail) {
          const { data: colab } = await supabase
            .from("colaboradores")
            .select("nome,cargo")
            .eq("email", userEmail)
            .maybeSingle<ColaboradorName>();

          if ((!resolvedFullName || resolvedFullName.includes("@")) && colab?.nome?.trim()) {
            resolvedFullName = colab.nome.trim();
          }
          if (colab?.cargo?.trim()) {
            resolvedJobTitle = colab.cargo.trim();
          }
        }

        setRole(r);
        setFullName(resolvedFullName || null);
        setJobTitle(resolvedJobTitle);
        setAvatarUrl(resolvePortalAvatarUrl(profile.avatar_url));

        const hiddenRoutesReq = supabase
          .from("portal_feature_visibility")
          .select("route_path,hidden")
          .eq("hidden", true);

        const companyReq = profile.company_id
          ? supabase
              .from("companies")
              .select("id, name, logo_url, primary_color")
              .eq("id", profile.company_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null });

        const departmentReq = profile.department_id
          ? supabase.from("departments").select("id, name").eq("id", profile.department_id).maybeSingle()
          : Promise.resolve({ data: null, error: null });

        const [hiddenRoutesRes, companyRes, departmentRes] = await Promise.all([hiddenRoutesReq, companyReq, departmentReq]);

        if (!alive.current) return;

        if (!hiddenRoutesRes.error) {
          const routes = new Set<string>();
          for (const row of (hiddenRoutesRes.data ?? []) as HiddenRouteRow[]) {
            const route = typeof row.route_path === "string" ? row.route_path.trim() : "";
            if (route) routes.add(route);
          }
          setHiddenRoutes(routes);
        } else {
          setHiddenRoutes(new Set());
        }
        setHiddenRoutesLoaded(true);

        setCompany(!companyRes.error && companyRes.data ? (companyRes.data as Company) : null);
        setDepartment(!departmentRes.error && departmentRes.data ? (departmentRes.data as Department) : null);
      } catch (err: unknown) {
        if (!alive.current) return;

        if (err instanceof Error && err.message === "timeout") {
          setFatalError("Tempo esgotado ao validar sessão. Verifique conexão e Supabase.");
          return;
        }

        setFatalError("Erro inesperado ao carregar o portal.");
        setDebugErr(err instanceof Error ? err.message : "Sem detalhes");
      } finally {
        if (alive.current) setLoading(false);
        inFlight.current = false;
      }
    }

    void boot({ resetVisibilityState: !hydratedFromCache.current, silent: hydratedFromCache.current });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "TOKEN_REFRESHED") return;
      setRole(null);
      setCompany(null);
      setDepartment(null);
      setFullName(null);
      setJobTitle(null);
      setAvatarUrl(null);
      setFatalError(null);
      setDebugErr(null);
      void boot();
    });

    const onProfileUpdated = () => {
      void boot({ resetVisibilityState: false });
    };
    if (typeof window !== "undefined") {
      window.addEventListener("portal-profile-updated", onProfileUpdated);
    }

    return () => {
      alive.current = false;
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("portal-profile-updated", onProfileUpdated);
      }
    };
  }, [router]);

  useEffect(() => {
    if (!role || !hiddenRoutesLoaded) return;
    writePortalShellCache({
      role,
      company,
      department,
      fullName,
      jobTitle,
      avatarUrl,
      hiddenRoutes: Array.from(hiddenRoutes),
    });
  }, [avatarUrl, company, department, fullName, hiddenRoutes, hiddenRoutesLoaded, jobTitle, role]);

  useEffect(() => {
    if (!role) return;
    let mounted = true;

    async function loadHiddenRoutes() {
      const { data, error } = await supabase
        .from("portal_feature_visibility")
        .select("route_path,hidden")
        .eq("hidden", true);
      if (!mounted || error) return;

      const routes = new Set<string>();
      for (const row of data ?? []) {
        const route = typeof row.route_path === "string" ? row.route_path.trim() : "";
        if (route) routes.add(route);
      }
      setHiddenRoutes(routes);
      setHiddenRoutesLoaded(true);
    }

    void loadHiddenRoutes();
    const onVisibilityUpdated = () => {
      void loadHiddenRoutes();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("portal-feature-visibility-updated", onVisibilityUpdated);
    }
    return () => {
      mounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("portal-feature-visibility-updated", onVisibilityUpdated);
      }
    };
  }, [role]);

  useEffect(() => {
    if (!pathname || !role || !hiddenRoutesLoaded) return;
    if (pathname === "/unauthorized") return;
    if (pathname === "/admin/funcionalidades") return;
    if (isRouteHidden(pathname, hiddenRoutes)) {
      router.replace("/unauthorized");
    }
  }, [hiddenRoutes, hiddenRoutesLoaded, pathname, role, router]);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    const restore = window.requestAnimationFrame(() => {
      try {
        const raw = window.sessionStorage.getItem(getScrollStorageKey(pathname));
        const scrollY = raw ? Number(raw) : 0;
        window.scrollTo({ top: Number.isFinite(scrollY) ? scrollY : 0, behavior: "auto" });
      } catch {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    });

    return () => {
      window.cancelAnimationFrame(restore);
      try {
        window.sessionStorage.setItem(getScrollStorageKey(pathname), String(window.scrollY));
      } catch {
        // noop
      }
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    const restoreDraft = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          restoreDraftSnapshot(pathname);
        });
      });
    };

    const persistDraft = () => {
      persistDraftSnapshot(pathname);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistDraft();
        return;
      }
      if (document.visibilityState === "visible") {
        restoreDraft();
      }
    };

    restoreDraft();
    window.addEventListener("pagehide", persistDraft);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      persistDraft();
      window.removeEventListener("pagehide", persistDraft);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname]);

  if (loading || !hiddenRoutesLoaded) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4">
          <p className="text-sm text-slate-600">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-slate-900">Acesso bloqueado</h1>
          <p className="mt-2 text-sm text-slate-700">{fatalError}</p>

          {debugErr ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">Detalhe do erro (Supabase):</p>
              <p className="mt-1 break-words text-xs text-amber-800">{debugErr}</p>
            </div>
          ) : null}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => router.replace("/")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Voltar ao login
            </button>
            <button
              onClick={async () => {
                await forceClientLogout();
                router.replace("/");
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-slate-900">Carregamento incompleto</h1>
          <p className="mt-2 text-sm text-slate-700">Não foi possível identificar sua função (role).</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => router.replace("/")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {!sidebarCollapsed ? (
          <Sidebar
            role={role}
            fullName={fullName}
            avatarUrl={avatarUrl}
            companyName={company?.name ?? null}
            companyLogoUrl={company?.logo_url ?? null}
            departmentName={department?.name ?? null}
            jobTitle={jobTitle}
            hiddenRoutes={hiddenRoutes}
            onCollapse={() => setSidebarCollapsed(true)}
          />
        ) : null}

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
            {sidebarCollapsed ? (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title="Mostrar menu lateral"
                  aria-label="Mostrar menu lateral"
                >
                  <ChevronRight size={16} />
                  Menu
                </button>
              </div>
            ) : null}
            <div className="mb-4 flex items-center justify-end">
              <NotificationBell />
            </div>
            {children}
            <div className="mt-8 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-xs text-slate-500">
                <p>Privacidade e tratamento de dados do portal.</p>
                <Link href="/institucional/privacidade" className="font-semibold text-slate-700 hover:text-slate-900">
                  Abrir aviso de privacidade
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
