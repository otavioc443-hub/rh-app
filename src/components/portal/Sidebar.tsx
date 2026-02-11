"use client";

import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Building2,
  UserRound,
  ChevronDown,
  LogOut,
  MessageSquareText,
  LineChart,
  CalendarClock,
  BadgeCheck,
  ClipboardList,
  Shield,
  Users,
  UserPlus,
  Briefcase,
  Layers,
  LayoutDashboard,
  UserCog,
  Calendar,
  Cake,
  MonitorCheck,
  GitBranch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "admin";

type NavChild = { label: string; icon?: LucideIcon; href: string; exact?: boolean };
type NavItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  exact?: boolean;
  children?: NavChild[];
  roles?: Role[];
};

declare global {
  interface Window {
    __logoutManual?: () => Promise<void>;
  }
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();

  const nav = useMemo<NavItem[]>(
    () => [
      {
        label: "Home",
        icon: Home,
        href: "/home",
        roles: ["colaborador", "coordenador", "gestor", "rh", "admin"],
      },

      {
        label: "Institucional",
        icon: Building2,
        roles: ["colaborador", "coordenador", "gestor", "rh", "admin"],
        children: [
          { label: "Visão Geral", icon: LayoutDashboard, href: "/institucional", exact: true },
          { label: "Organograma", icon: GitBranch, href: "/institucional/organograma" },
        ],
      },

      {
        label: "Meu perfil",
        icon: UserRound,
        roles: ["colaborador", "coordenador", "gestor", "rh", "admin"],
        children: [
          { label: "Feedbacks", icon: MessageSquareText, href: "/meu-perfil/feedbacks" },
          { label: "PDI", icon: LineChart, href: "/meu-perfil/pdi" },

          // ✅ rota que vamos criar: /meu-perfil/ausencias-programadas
          { label: "Ausências programadas", icon: CalendarClock, href: "/meu-perfil/ausencias-programadas" },

          { label: "Competências", icon: BadgeCheck, href: "/meu-perfil/competencias" },
          { label: "Avaliação de desempenho", icon: ClipboardList, href: "/meu-perfil/avaliacao-desempenho" },
        ],
      },

      {
        label: "Agenda",
        icon: Calendar,
        roles: ["colaborador", "coordenador", "gestor", "rh", "admin"],
        children: [
          { label: "Aniversariantes", icon: Cake, href: "/agenda/aniversariantes" },
          { label: "Agenda institucional", icon: CalendarClock, href: "/agenda/agenda-institucional" },

          // ✅ (opcional) atalho direto
          { label: "Ausências programadas", icon: CalendarClock, href: "/meu-perfil/ausencias-programadas" },
        ],
      },

      {
        label: "Coordenador",
        icon: Layers,
        href: "/coordenador",
        exact: true,
        roles: ["coordenador", "admin"],
      },

      {
        label: "Gestor",
        icon: Briefcase,
        roles: ["gestor", "admin"],
        children: [
          { label: "Painel Gestor", icon: LayoutDashboard, href: "/gestor", exact: true },

          // ✅ rota que vamos criar: /gestor/ausencias
          { label: "Ausências", icon: CalendarClock, href: "/gestor/ausencias" },
        ],
      },

      // ✅ RH atualizado
      {
        label: "RH",
        icon: Users,
        roles: ["rh", "admin"],
        children: [
          { label: "Painel RH", icon: LayoutDashboard, href: "/rh", exact: true },
          { label: "Colaboradores", icon: Users, href: "/rh/colaboradores" },
          { label: "Adicionar Colaborador", icon: UserPlus, href: "/rh/adicionar-colaborador" },
          { label: "Inclusão Cargos", icon: Briefcase, href: "/rh/cargos" },

          // ✅ rota que vamos criar: /rh/ausencias
          { label: "Ausências", icon: CalendarClock, href: "/rh/ausencias" },
        ],
      },

      {
        label: "Admin",
        icon: Shield,
        roles: ["admin"],
        children: [
          { label: "Painel Admin", icon: LayoutDashboard, href: "/admin", exact: true },
          { label: "Cadastro de empresas", icon: Building2, href: "/admin/empresas" },
          { label: "Sessões", icon: MonitorCheck, href: "/admin/sessoes" },
          { label: "Permissões", icon: UserCog, href: "/admin/permissoes" },
        ],
      },
    ],
    []
  );

  const navByRole = useMemo(
    () => nav.filter((item) => !item.roles || item.roles.includes(role)),
    [nav, role]
  );

  const isActive = (href?: string, exact?: boolean) => {
    if (!href) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const computeInitialOpen = () => {
    const open: Record<string, boolean> = {};
    for (const item of navByRole) {
      if (item.children?.some((c) => isActive(c.href, c.exact))) open[item.label] = true;
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups(computeInitialOpen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, role]);

  async function handleLogout() {
    try {
      if (typeof window !== "undefined" && window.__logoutManual) {
        await window.__logoutManual();
      }
    } catch {}
    await supabase.auth.signOut();
    router.replace("/");
  }

  const headerRoleLabel =
    role === "admin"
      ? "Acesso administrador"
      : role === "rh"
      ? "Acesso RH"
      : role === "gestor"
      ? "Acesso gestor"
      : role === "coordenador"
      ? "Acesso coordenador"
      : "Acesso colaborador";

  return (
    <aside className="sticky top-0 h-screen w-[280px] border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white font-semibold">
          RH
        </div>

        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">Portal de RH</div>
          <div className="text-xs text-slate-500">{headerRoleLabel}</div>
        </div>
      </div>

      <nav className="px-3 pb-24">
        {navByRole.map((item) => {
          const Icon = item.icon;

          if (!item.children?.length) {
            const active = isActive(item.href, item.exact);
            return (
              <button
                key={item.label}
                onClick={() => item.href && router.push(item.href)}
                className={cx(
                  "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                  active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <Icon size={18} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          }

          const groupOpen = !!openGroups[item.label];
          const anyChildActive = item.children.some((c) => isActive(c.href, c.exact));

          return (
            <div key={item.label} className="mb-2">
              <button
                type="button"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !prev[item.label] }))}
                className={cx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                  groupOpen || anyChildActive ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <Icon size={18} />
                <span className="flex-1 font-medium">{item.label}</span>
                <ChevronDown size={16} className={cx("transition", groupOpen && "rotate-180")} />
              </button>

              {groupOpen && (
                <div className="mt-1 space-y-1 pl-2">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    const active = isActive(child.href, child.exact);

                    return (
                      <button
                        key={child.href}
                        onClick={() => router.push(child.href)}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                          active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        {ChildIcon ? <ChildIcon size={16} /> : <span className="w-4" />}
                        <span>{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4 bg-white">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
