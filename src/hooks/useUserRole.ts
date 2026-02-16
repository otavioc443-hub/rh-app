"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "financeiro" | "admin";
type ProfileRow = { role: Role | null; active: boolean | null };
type CurrentRoleResult = string | null;

const ROLE_SET = new Set<Role>(["colaborador", "coordenador", "gestor", "rh", "financeiro", "admin"]);

function coerceRole(v: unknown): Role | null {
  if (!v) return null;
  const s = String(v) as Role;
  return ROLE_SET.has(s) ? s : null;
}

// cache em memória (persiste durante a sessão do app)
let cached:
  | { role: Role | null; active: boolean; userId: string | null; ts: number }
  | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function normalizeSupabaseError(e: unknown): string {
  if (!e) return "Erro desconhecido.";
  const err = e as Record<string, unknown>;
  // supabase-js geralmente vem com message
  const msg = err?.message ? String(err.message) : "";
  const hint = err?.hint ? ` | hint: ${String(err.hint)}` : "";
  const code = err?.code ? ` | code: ${String(err.code)}` : "";
  const details = err?.details ? ` | details: ${String(err.details)}` : "";
  const status = err?.status ? ` | status: ${String(err.status)}` : "";
  const name = err?.name ? ` | name: ${String(err.name)}` : "";
  const base = msg || JSON.stringify(e);
  return `${base}${code}${status}${details}${hint}${name}`.trim();
}

export function useUserRole() {
  const [loading, setLoading] = useState(() => {
    if (!cached) return true;
    return Date.now() - cached.ts > CACHE_TTL_MS;
  });

  const [role, setRole] = useState<Role | null>(cached?.role ?? null);
  const [active, setActive] = useState<boolean>(cached?.active ?? false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function refresh({ silent }: { silent: boolean }) {
      if (inFlight.current) return;
      inFlight.current = true;

      if (!silent) setLoading(true);
      setError(null);

      try {
        const { data: sessRes, error: sessErr } = await supabase.auth.getSession();
        if (!mounted.current) return;

        if (sessErr) {
          cached = null;
          setRole(null);
          setActive(false);
          setError(normalizeSupabaseError(sessErr));
          return;
        }

        const userId = sessRes.session?.user?.id ?? null;

        if (!userId) {
          cached = { role: null, active: false, userId: null, ts: Date.now() };
          setRole(null);
          setActive(false);
          return;
        }

        // cache válido
        if (cached?.userId === userId && Date.now() - cached.ts <= CACHE_TTL_MS) {
          setRole(cached.role);
          setActive(cached.active);
          return;
        }

        // âœ… TROCA CRÃTICA: single() -> maybeSingle()
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("role, active")
          .eq("id", userId)
          .maybeSingle();

        if (!mounted.current) return;

        if (profErr) {
          // Aqui é erro REAL: RLS/GRANT/permission denied etc.
          cached = null;
          setRole(null);
          setActive(false);
          setError(`Erro ao ler profiles: ${normalizeSupabaseError(profErr)}`);
          return;
        }

        if (!profile) {
          // profile não existe (0 linhas). Não é necessariamente "RLS".
          cached = null;
          setRole(null);
          setActive(false);
          setError(
            "Perfil não encontrado em profiles para este usuário. Crie o registro (ou ative trigger de auto-profile)."
          );
          return;
        }

        const p = profile as ProfileRow;

        // Role efetiva: preferimos a funcao do banco (current_role),
        // pois ela pode considerar mapeamento por cargo (cargos.portal_role).
        let effectiveRole: Role | null = coerceRole(p.role);
        try {
          const { data: cr, error: crErr } = await supabase.rpc("current_role");
          if (!mounted.current) return;
          if (!crErr) effectiveRole = coerceRole(cr as CurrentRoleResult) ?? effectiveRole;
        } catch {
          // fallback silencioso: mantem a role do profile
        }

        cached = {
          role: effectiveRole,
          active: p.active === true,
          userId,
          ts: Date.now(),
        };

        setRole(cached.role);
        setActive(cached.active);

        // Se vier role null, já avisa
        if (!cached.role) {
          setError("Seu perfil está sem role. Defina role = colaborador/gestor/rh/admin.");
        }
      } catch (e: unknown) {
        if (!mounted.current) return;
        cached = null;
        setRole(null);
        setActive(false);
        setError(normalizeSupabaseError(e));
      } finally {
        if (mounted.current) setLoading(false);
        inFlight.current = false;
      }
    }

    const hasValidCache = !!cached && Date.now() - cached.ts <= CACHE_TTL_MS;
    refresh({ silent: hasValidCache });

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      cached = session?.user?.id
        ? {
            role: cached?.role ?? null,
            active: cached?.active ?? false,
            userId: session.user.id,
            ts: 0,
          }
        : null;
      refresh({ silent: true });
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = active && role === "admin";
  const isRH = active && (role === "rh" || role === "admin");
  const isGestor = active && role === "gestor";
  const isFinanceiro = active && (role === "financeiro" || role === "admin");

  return { loading, role, active, isAdmin, isRH, isGestor, isFinanceiro, error };
}

