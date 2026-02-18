"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/portal/Sidebar";
import NotificationBell from "@/components/portal/NotificationBell";
import { isRouteHidden } from "@/lib/featureVisibility";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "financeiro" | "pd" | "admin";

const ROLE_SET = new Set<Role>(["colaborador", "coordenador", "gestor", "rh", "financeiro", "pd", "admin"]);
function coerceRole(v: unknown): Role | null {
  if (!v) return null;
  const s = String(v) as Role;
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

type ColaboradorName = {
  nome: string | null;
  cargo: string | null;
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

  const inFlight = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    async function safeRedirectToLogin() {
      if (window.location.pathname === "/") return;
      router.replace("/?redirectedFrom=%2Fhome");
    }

    async function boot() {
      if (inFlight.current) return;
      inFlight.current = true;

      setLoading(true);
      setFatalError(null);
      setDebugErr(null);

      try {
        const { data: sessRes, error: sessErr } = await withTimeout(supabase.auth.getSession(), 7000);

        if (!alive.current) return;

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

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role, active, company_id, department_id, full_name, avatar_url")
          .eq("id", userId)
          .maybeSingle<Profile>();

        if (!alive.current) return;

        if (profileErr) {
          setFatalError("Nao foi possivel ler profiles. Verifique RLS/Policy/GRANT ou cadastro.");
          setDebugErr(profileErr.message);
          return;
        }

        if (!profile) {
          setFatalError("Perfil nao encontrado na tabela profiles para este usuario.");
          setDebugErr(`Nenhuma linha encontrada para id=${userId}`);
          return;
        }

        if (profile.active === false) {
          setFatalError("Usuario inativo. Procure o administrador do sistema.");
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
          setFatalError("Perfil sem funcao (role). Defina role = colaborador/coordenador/gestor/rh/financeiro/pd/admin.");
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
        setAvatarUrl(profile.avatar_url ?? null);

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

        const [companyRes, departmentRes] = await Promise.all([companyReq, departmentReq]);

        if (!alive.current) return;

        setCompany(!companyRes.error && companyRes.data ? (companyRes.data as Company) : null);
        setDepartment(!departmentRes.error && departmentRes.data ? (departmentRes.data as Department) : null);
      } catch (err: unknown) {
        if (!alive.current) return;

        if (err instanceof Error && err.message === "timeout") {
          setFatalError("Tempo esgotado ao validar sessao. Verifique conexao e Supabase.");
          return;
        }

        setFatalError("Erro inesperado ao carregar o portal.");
        setDebugErr(err instanceof Error ? err.message : "Sem detalhes");
      } finally {
        if (alive.current) setLoading(false);
        inFlight.current = false;
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      setRole(null);
      setCompany(null);
      setDepartment(null);
      setFullName(null);
      setJobTitle(null);
      setAvatarUrl(null);
      setFatalError(null);
      setDebugErr(null);
      boot();
    });

    const onProfileUpdated = () => {
      void boot();
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
    if (!pathname || !role) return;
    if (pathname === "/unauthorized") return;
    if (pathname === "/admin/funcionalidades") return;
    if (isRouteHidden(pathname, hiddenRoutes)) {
      router.replace("/unauthorized");
    }
  }, [hiddenRoutes, pathname, role, router]);

  if (loading) {
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
                await supabase.auth.signOut();
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
          <p className="mt-2 text-sm text-slate-700">Nao foi possivel identificar sua funcao (role).</p>
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
        <Sidebar
          role={role}
          fullName={fullName}
          avatarUrl={avatarUrl}
          companyName={company?.name ?? null}
          companyLogoUrl={company?.logo_url ?? null}
          departmentName={department?.name ?? null}
          jobTitle={jobTitle}
        />

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
            <div className="mb-4 flex items-center justify-end">
              <NotificationBell />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
