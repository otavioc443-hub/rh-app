"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Gift, Megaphone, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Announcement = {
  id: string;
  label: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
  display_order: number | null;
  created_at: string | null;
};

type InstitutionalEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
};

type CollaboratorBirthday = {
  id: string;
  company_id?: string | null;
  nome: string | null;
  data_nascimento: string | null;
  departamento: string | null;
  cargo: string | null;
  empresa?: string | null;
};

type BirthdayPreview = {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  nextDate: Date;
  daysLeft: number;
};

const FALLBACK_ANNOUNCEMENT: Announcement = {
  id: "fallback",
  label: "Aviso institucional",
  title: "Comunicados institucionais",
  body: "Acompanhe os avisos oficiais, campanhas internas e novidades da organização.",
  cta_label: "Ver comunicados",
  cta_href: "/institucional/rede-social",
  display_order: 0,
  created_at: null,
};

function parseDateOnly(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function birthdayDateThisYear(birthIso: string, now = new Date()) {
  const birth = parseDateOnly(birthIso);
  const currentYear = now.getFullYear();
  return new Date(currentYear, birth.getMonth(), birth.getDate());
}

function nextBirthdayDate(birthIso: string, now = new Date()) {
  const birthday = birthdayDateThisYear(birthIso, now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (birthday.getTime() >= today) return birthday;
  const birth = parseDateOnly(birthIso);
  return new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
}

function diffInDays(a: Date, b: Date) {
  const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.max(0, Math.round((x - y) / 86400000));
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function normalizeCompanyName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function belongsToCompany(
  rowCompanyId: string | null | undefined,
  rowCompany: string | null | undefined,
  currentCompanyId: string | null | undefined,
  currentCompany: string | null
) {
  if (currentCompanyId && rowCompanyId === currentCompanyId) return true;
  if (!currentCompany) return !currentCompanyId;
  const current = normalizeCompanyName(currentCompany);
  const row = normalizeCompanyName(rowCompany);
  return Boolean(row) && (row === current || row.includes(current) || current.includes(row));
}

export default function HomePage() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([FALLBACK_ANNOUNCEMENT]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [events, setEvents] = useState<InstitutionalEvent[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayPreview[]>([]);

  useEffect(() => {
    async function loadHomeData() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,company_id")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null; company_id: string | null }>();

      const email = user.email ?? null;
      let resolved = profile?.full_name?.trim() ?? "";
      let collaboratorCompany: string | null = null;

      if (email) {
        const { data: colab } = await supabase
          .from("colaboradores")
          .select("nome,empresa")
          .eq("email", email)
          .maybeSingle<{ nome: string | null; empresa: string | null }>();

        if ((!resolved || resolved.includes("@")) && colab?.nome?.trim()) resolved = colab.nome.trim();
        collaboratorCompany = colab?.empresa?.trim() || null;
      }

      const currentCompanyId = profile?.company_id ?? null;
      let currentCompanyName = collaboratorCompany;
      if (currentCompanyId) {
        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", currentCompanyId)
          .maybeSingle<{ name: string | null }>();
        currentCompanyName = company?.name?.trim() || currentCompanyName;
      }

      setDisplayName(resolved || "Usuário");

      const todayIso = new Date().toISOString().slice(0, 10);
      const [announcementRes, eventsRes, birthdayRes] = await Promise.all([
        supabase
          .from("pulsehub_home_announcements")
          .select("id,label,title,body,cta_label,cta_href,display_order,created_at")
          .eq("active", true)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("institutional_events")
          .select("id,title,description,event_date")
          .gte("event_date", todayIso)
          .order("event_date", { ascending: true })
          .limit(3),
        supabase
          .from("colaboradores")
          .select("id,company_id,nome,data_nascimento,departamento,cargo,empresa")
          .eq("is_active", true)
          .not("data_nascimento", "is", null),
      ]);

      if (!announcementRes.error && announcementRes.data?.length) {
        setAnnouncements(announcementRes.data as Announcement[]);
        setAnnouncementIndex(0);
      }

      if (!eventsRes.error) {
        setEvents((eventsRes.data ?? []) as InstitutionalEvent[]);
      }

      if (!birthdayRes.error) {
        const now = new Date();
        const normalized = ((birthdayRes.data ?? []) as CollaboratorBirthday[])
          .filter(
            (row) =>
              Boolean(row.data_nascimento) &&
              belongsToCompany(row.company_id, row.empresa, currentCompanyId, currentCompanyName)
          )
          .map((row) => {
            const next = nextBirthdayDate(String(row.data_nascimento), now);
            return {
              id: row.id,
              nome: row.nome ?? "Sem nome",
              cargo: row.cargo ?? "-",
              departamento: row.departamento ?? "-",
              nextDate: next,
              daysLeft: diffInDays(next, now),
            };
          })
          .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
          .slice(0, 2);
        setBirthdays(normalized);
      }
    }

    void loadHomeData();
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = window.setInterval(() => {
      setAnnouncementIndex((current) => (current + 1) % announcements.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [announcements.length]);

  const activeAnnouncement = announcements[announcementIndex] ?? FALLBACK_ANNOUNCEMENT;
  const todayBirthdays = useMemo(() => birthdays.filter((item) => item.daysLeft === 0), [birthdays]);
  const birthdayPreview = todayBirthdays.length ? todayBirthdays : birthdays.slice(0, 2);

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

      <div className="relative min-h-[236px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white">
        <div className="relative z-10 max-w-[760px] space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
            <Megaphone size={14} /> {activeAnnouncement.label || "Comunicado"}
          </div>
          <h2 className="text-xl font-semibold">{activeAnnouncement.title}</h2>
          <p className="max-w-2xl text-sm text-white/80">{activeAnnouncement.body}</p>

          <a
            href={activeAnnouncement.cta_href || "/institucional/rede-social"}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            {activeAnnouncement.cta_label || "Ver comunicados"} <ArrowRight size={16} />
          </a>

          {announcements.length > 1 ? (
            <div className="flex gap-2 pt-3">
              {announcements.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Comunicado ${index + 1}`}
                  onClick={() => setAnnouncementIndex(index)}
                  className={[
                    "h-2.5 rounded-full transition-all",
                    index === announcementIndex ? "w-8 bg-white" : "w-2.5 bg-white/35 hover:bg-white/60",
                  ].join(" ")}
                />
              ))}
            </div>
          ) : null}
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
            {events.length ? (
              events.slice(0, 2).map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">{formatDate(event.event_date)}</div>
                  <div className="text-sm font-medium text-slate-900">{event.title}</div>
                  <div className="text-sm text-slate-600">{event.description || "Sem descrição"}</div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-900">Nenhum evento futuro</div>
                <div className="text-sm text-slate-600">A agenda será exibida assim que houver cadastro.</div>
              </div>
            )}

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
            {birthdayPreview.length ? (
              birthdayPreview.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-medium text-slate-900">{item.nome}</div>
                  <div className="text-sm text-slate-600">
                    {item.daysLeft === 0 ? "Hoje" : `${item.nextDate.toLocaleDateString("pt-BR")} - em ${item.daysLeft} dia(s)`}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-900">Nenhum aniversário</div>
                <div className="text-sm text-slate-600">Cadastre datas de nascimento para visualizar os próximos aniversariantes.</div>
              </div>
            )}

            <a href="/agenda/aniversariantes" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:underline">
              Ver aniversariantes <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
