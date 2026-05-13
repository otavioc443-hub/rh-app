"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markPasswordRecoveryIntent } from "@/lib/supabaseClient";

export default function AuthRecoveryPage() {
  const router = useRouter();

  useEffect(() => {
    markPasswordRecoveryIntent();
    const target = `/set-password?flow=recovery${window.location.search ? `&${window.location.search.slice(1)}` : ""}${window.location.hash}`;
    router.replace(target);
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4">
        <p className="text-sm text-slate-600">Preparando redefinição de senha...</p>
      </div>
    </div>
  );
}
