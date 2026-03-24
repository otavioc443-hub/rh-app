"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolvePortalAvatarUrl } from "@/lib/avatarUrl";
import { supabase } from "../../lib/supabaseClient"; // <- use relativo pra nÃ£o depender do "@"

type Role = "user" | "rh" | "admin" | "compliance";

type AuthState = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: Role | null;
  companyId: string | null;
  departmentId: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    email: null,
    fullName: null,
    avatarUrl: null,
    role: null,
    companyId: null,
    departmentId: null,
  });

  async function load() {
    setState((s) => ({ ...s, loading: true }));
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      setState((s) => ({
        ...s,
        loading: false,
        userId: null,
        email: null,
        role: null,
        fullName: null,
        avatarUrl: null,
        companyId: null,
        departmentId: null,
      }));
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, role, company_id, department_id")
      .eq("id", user.id)
      .single();

    setState({
      loading: false,
      userId: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      avatarUrl: resolvePortalAvatarUrl(profile?.avatar_url ?? null),
      role: profile?.role ?? null,
      companyId: profile?.company_id ?? null,
      departmentId: profile?.department_id ?? null,
    });
  }

  useEffect(() => {
    const runLoad = () => {
      void load();
    };

    queueMicrotask(runLoad);
    const { data: sub } = supabase.auth.onAuthStateChange(runLoad);
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext deve ser usado dentro de AuthProvider");
  return ctx;
}
