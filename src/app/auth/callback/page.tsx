"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (!code) {
        router.replace("/?err=link_invalido");;
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        router.replace("/?err=link_invalido");
        return;
      }

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
