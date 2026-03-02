"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearPortalExitIntent, markRecentLogin, supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      let errorMessage: string | null = null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        errorMessage = error?.message ?? null;
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
          token_hash: tokenHash,
        });
        errorMessage = error?.message ?? null;
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        errorMessage = error?.message ?? null;
      } else {
        router.replace("/?err=link_invalido");
        return;
      }

      if (errorMessage) {
        router.replace("/?err=link_invalido");
        return;
      }

      clearPortalExitIntent();
      markRecentLogin();
      router.replace("/set-password");
    }

    run();
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4">
        <p className="text-sm text-slate-600">Validando acesso...</p>
      </div>
    </div>
  );
}
