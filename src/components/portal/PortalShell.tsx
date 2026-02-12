"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/portal/Sidebar";

type Role = "colaborador" | "gestor" | "rh" | "admin";

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

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [debugErr, setDebugErr] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);

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
        if (!userId) {
          await safeRedirectToLogin();
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role, active, company_id, department_id")
          .eq("id", userId)
          .maybeSingle();

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

        const r = (profile.role ?? null) as Role | null;
        if (!r) {
          setFatalError("Perfil sem funcao (role). Defina role = colaborador/gestor/rh/admin.");
          return;
        }

        setRole(r);

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
      setFatalError(null);
      setDebugErr(null);
      boot();
    });

    return () => {
      alive.current = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

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

  const companyName = company?.name ?? "Portal de RH";
  const deptName = department?.name ?? null;
  const roleLabel =
    role === "admin" ? "Admin" : role === "rh" ? "RH" : role === "gestor" ? "Gestor" : "Colaborador";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar role={role} />

        <main className="flex-1">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
            <div className="mx-auto w-full max-w-[1400px] px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {company?.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={companyName}
                      className="h-10 w-10 rounded-xl object-contain border border-slate-200 bg-white"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white font-semibold">
                      RH
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{companyName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {deptName ? `Setor: ${deptName}` : "Setor nao informado"}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[1400px] px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
