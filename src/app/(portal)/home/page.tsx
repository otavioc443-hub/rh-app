"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Gift, Megaphone, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    async function loadName() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null }>();

      const email = user.email ?? null;

      let resolved = profile?.full_name?.trim() ?? "";

      // Se o full_name nao existe ou parece email, tenta puxar o "nome" do cadastro de colaboradores.
      if ((!resolved || resolved.includes("@")) && email) {
        const { data: colab } = await supabase
          .from("colaboradores")
          .select("nome")
          .eq("email", email)
          .maybeSingle<{ nome: string | null }>();

        if (colab?.nome?.trim()) resolved = colab.nome.trim();
      }

      // Fallback final: nunca exibir email no titulo.
      setDisplayName(resolved || "Usuário");
    }

    void loadName();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        {displayName === null ? (
          <div className="h-8 w-[260px] animate-pulse rounded-xl bg-slate-200" />
        ) : (
          <h1 className="text-2xl font-semibold text-slate-900">Olá, {displayName}</h1>
        )}
        <p className="text-sm text-slate-600">
          Bem-vindo ao Portal de RH. Acompanhe avisos, agenda e seus acessos rápidos.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white">
        <div className="max-w-[720px] space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
            <Megaphone size={14} /> Aviso institucional
          </div>
          <h2 className="text-xl font-semibold">Diagnóstico de cultura organizacional</h2>
          <p className="text-sm text-white/80">
            Participe do diagnóstico e ajude a fortalecer cultura, processos e bem-estar.
          </p>

          <a
            href="/institucional"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Ver comunicados <ArrowRight size={16} />
          </a>
        </div>

        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -right-10 bottom-[-60px] h-72 w-72 rounded-full bg-white/5" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">Meus atalhos</div>
          <div className="mt-1 text-sm text-slate-600">Acesse rápido o que você mais usa.</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a href="/meu-perfil/feedback" className="rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Feedbacks
            </a>
            <a href="/meu-perfil/pdi" className="rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              PDI
            </a>
            <a href="/meu-perfil/competencias" className="rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Competências
            </a>
            <a href="/meu-perfil/linha-do-tempo" className="rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Linha do tempo
            </a>
            <a href="/meu-perfil/avaliacao-desempenho" className="rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Avaliação
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-900">
              <CalendarDays size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Agenda institucional</div>
              <div className="text-sm text-slate-600">Próximos comunicados e datas.</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Em breve</div>
              <div className="text-sm font-medium text-slate-900">Reunião geral</div>
              <div className="text-sm text-slate-600">Horário a confirmar</div>
            </div>

            <a href="/agenda/agenda-institucional" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:underline">
              Ver agenda completa <ArrowRight size={16} />
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-900">
              <Gift size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Aniversariantes</div>
              <div className="text-sm text-slate-600">Celebre com o time</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-sm font-medium text-slate-900">Nenhum hoje</div>
              <div className="text-sm text-slate-600">Confira os próximos aniversários.</div>
            </div>

            <a href="/agenda/aniversariantes" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:underline">
              Ver aniversariantes <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

