"use client";

import { Suspense } from "react";
import CeoDashboardPage from "@/app/(portal)/ceo/page";

export default function CeoTvStandalonePage() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1800px]">
        <Suspense fallback={<div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-200">Carregando painel CEO...</div>}>
          <CeoDashboardPage />
        </Suspense>
      </div>
    </main>
  );
}
