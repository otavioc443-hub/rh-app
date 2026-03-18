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
  ShieldCheck,
  Users,
  UserPlus,
  Briefcase,
  FolderOpen,
  Layers,
  LayoutDashboard,
  UserCog,
  Calendar,
  Cake,
  Target,
  MonitorCheck,
  GitBranch,
  Wallet,
  Wrench,
  Trash2,
  ChevronLeft,
  FileCheck2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { forceClientLogout } from "@/lib/supabaseClient";
import { resolvePortalAvatarUrl } from "@/lib/avatarUrl";
import { isRouteHidden } from "@/lib/featureVisibility";

type Role = "colaborador" | "coordenador" | "gestor" | "diretoria" | "rh" | "financeiro" | "pd" | "admin";

type NavChild = { label: string; icon?: LucideIcon; href: string; exact?: boolean; roles?: Role[] };
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

type SidebarProps = {
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  departmentName: string | null;
  jobTitle: string | null;
  hiddenRoutes: Set<string>;
  onCollapse?: () => void;
};

export default function Sidebar({
  role,
  fullName,
  avatarUrl,
  companyName,
  companyLogoUrl,
  departmentName,
  jobTitle,
  hiddenRoutes,
  onCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const resolvedAvatarUrl = useMemo(() => resolvePortalAvatarUrl(avatarUrl), [avatarUrl]);

  const nav = useMemo<NavItem[]>(
    () => [
      {
        label: "Home",
        icon: Home,
        href: "/home",
        roles: ["colaborador", "coordenador", "gestor", "diretoria", "rh", "financeiro", "pd", "admin"],
      },

      {
        label: "Institucional",
        icon: Building2,
        roles: ["colaborador", "coordenador", "gestor", "diretoria", "rh", "financeiro", "pd", "admin"],
        children: [
          { label: "Visão Geral", icon: LayoutDashboard, href: "/institucional", exact: true },
          { label: "PulseHub", icon: MessageSquareText, href: "/institucional/rede-social" },
          { label: "Privacidade e LGPD", icon: FileCheck2, href: "/institucional/privacidade" },
          { label: "Organograma", icon: GitBranch, href: "/institucional/organograma", roles: ["gestor", "financeiro", "admin"] },
        ],
      },

      {
        label: "Meu perfil",
        icon: UserRound,
        roles: ["colaborador", "coordenador", "gestor", "rh", "admin"],
        children: [
          { label: "Meus dados", icon: UserRound, href: "/meu-perfil/meus-dados" },
          { label: "Chamados", icon: ClipboardList, href: "/meu-perfil/chamados" },
          { label: "Projetos", icon: ClipboardList, href: "/meu-perfil/projetos" },
          { label: "Nota fiscal", icon: Wallet, href: "/meu-perfil/nota-fiscal" },
          { label: "Linha do tempo", icon: GitBranch, href: "/meu-perfil/linha-do-tempo" },
          { label: "Feedbacks", icon: MessageSquareText, href: "/meu-perfil/feedback" },
          { label: "PDI", icon: LineChart, href: "/meu-perfil/pdi" },
          { label: "Competências", icon: BadgeCheck, href: "/meu-perfil/competencias" },
          { label: "Mapa comportamental", icon: BadgeCheck, href: "/meu-perfil/mapa-comportamental" },
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
          { label: "Ausências programadas", icon: CalendarClock, href: "/meu-perfil/ausencias-programadas" },
        ],
      },

      {
        label: "Coordenador",
        icon: Layers,
        roles: ["coordenador", "admin"],
        children: [
          { label: "Painel Coordenador", icon: LayoutDashboard, href: "/coordenador", exact: true },
          { label: "Aplicar Feedback", icon: MessageSquareText, href: "/coordenador/feedback" },
          { label: "Gestão de PDI", icon: LineChart, href: "/coordenador/feedback?tab=pdi" },
          { label: "Projetos", icon: ClipboardList, href: "/coordenador/projetos" },
        ],
      },

      {
        label: "Gestor",
        icon: Briefcase,
        roles: ["gestor", "admin"],
        children: [
          { label: "Painel Gestor", icon: LayoutDashboard, href: "/gestor", exact: true },
          { label: "Aplicar Feedback", icon: MessageSquareText, href: "/gestor/feedback" },
          { label: "Gestão de PDI", icon: LineChart, href: "/gestor/feedback?tab=pdi" },
          { label: "Projetos", icon: ClipboardList, href: "/gestor/projetos" },
          { label: "Pagamentos extras", icon: Wallet, href: "/gestor/pagamentos-extras" },
          { label: "Ausências", icon: CalendarClock, href: "/gestor/ausencias" },
        ],
      },

      {
        label: "Financeiro",
        icon: Wallet,
        roles: ["financeiro", "admin"],
        children: [
          { label: "Painel Financeiro", icon: LayoutDashboard, href: "/financeiro", exact: true },
          { label: "Visão gerencial", icon: LineChart, href: "/financeiro/gerencial" },
          { label: "Custos indiretos", icon: Layers, href: "/financeiro/custos-indiretos" },
          { label: "Solicitações", icon: ClipboardList, href: "/financeiro/solicitacoes" },
          { label: "Aprovar extras", icon: ShieldCheck, href: "/financeiro/pagamentos-extras" },
          { label: "Notas fiscais", icon: Wallet, href: "/financeiro/notas-fiscais" },
          { label: "Remessas", icon: Wallet, href: "/financeiro/remessas" },
        ],
      },

      {
        label: "Metas",
        icon: Target,
        href: "/metas",
        exact: true,
        roles: ["colaborador", "coordenador", "gestor", "rh", "financeiro", "pd", "admin"],
      },

      {
        label: "P&D",
        icon: Wrench,
        roles: ["pd"],
        children: [
          { label: "Painel P&D", icon: LayoutDashboard, href: "/p-d", exact: true },
          { label: "Chamados", icon: ClipboardList, href: "/p-d/chamados" },
          { label: "Projetos", icon: Layers, href: "/p-d/projetos" },
        ],
      },

      {
        label: "CEO",
        icon: Shield,
        roles: ["diretoria", "admin"],
        children: [
          { label: "Painel CEO", icon: LayoutDashboard, href: "/ceo", exact: true },
          { label: "Painel TV", icon: MonitorCheck, href: "/ceo-tv" },
          { label: "Presets TV", icon: CalendarClock, href: "/ceo/painel-tv-config" },
          { label: "Aprovar aditivos", icon: ClipboardList, href: "/ceo/aditivos-contratuais", exact: true },
        ],
      },

      {
        label: "RH",
        icon: Users,
        roles: ["rh", "admin"],
        children: [
          { label: "Painel RH", icon: LayoutDashboard, href: "/rh", exact: true },
          { label: "Dashboard RH", icon: LineChart, href: "/rh/dashboard" },
          { label: "Demografia", icon: Users, href: "/rh/demografia" },
          { label: "Solicitações", icon: ClipboardList, href: "/rh/solicitacoes" },
          { label: "Colaboradores", icon: Users, href: "/rh/colaboradores" },
          { label: "Adicionar Colaborador", icon: UserPlus, href: "/rh/adicionar-colaborador" },
          { label: "Inclusão Cargos", icon: Briefcase, href: "/rh/cargos" },
          { label: "Institucional", icon: Building2, href: "/rh/institucional" },
          { label: "Governança Feedback", icon: MessageSquareText, href: "/rh/feedbacks" },
          { label: "Mapa comportamental", icon: BadgeCheck, href: "/rh/mapa-comportamental" },
          { label: "Ausências", icon: CalendarClock, href: "/rh/ausencias" },
          { label: "LGPD", icon: FileCheck2, href: "/rh/lgpd" },
        ],
      },

      {
        label: "Diretoria",
        icon: Briefcase,
        roles: ["admin"],
        children: [
          { label: "Acompanhamento", icon: ClipboardList, href: "/diretoria/projetos", exact: true },
          { label: "Novo projeto", icon: Briefcase, href: "/diretoria/projetos/novo" },
          { label: "Projetos cadastrados", icon: FolderOpen, href: "/diretoria/projetos/cadastrados" },
          { label: "Medições/Boletins", icon: ClipboardList, href: "/diretoria/medicoes" },
          { label: "Aditivos/Contratos", icon: ClipboardList, href: "/diretoria/contratos" },
          { label: "Clientes", icon: Building2, href: "/diretoria/clientes" },
        ],
      },

      {
        label: "Admin",
        icon: Shield,
        roles: ["admin"],
        children: [
          { label: "Painel Admin", icon: LayoutDashboard, href: "/admin", exact: true },
          { label: "Cadastro de empresas", icon: Building2, href: "/admin/empresas" },
          { label: "Canal de ética", icon: FileCheck2, href: "/admin/canal-de-etica" },
          { label: "Configuração SLA", icon: CalendarClock, href: "/admin/sla" },
          { label: "Notificações", icon: MessageSquareText, href: "/admin/notificacoes" },
          { label: "Visibilidade", icon: Layers, href: "/admin/funcionalidades" },
          { label: "Limpeza de dados", icon: Trash2, href: "/admin/limpeza-dados" },
          { label: "Sessões", icon: MonitorCheck, href: "/admin/sessoes" },
          { label: "Permissões", icon: UserCog, href: "/admin/permissoes" },
        ],
      },
    ],
    []
  );

  const navByRole = useMemo(() => {
    return nav
      .filter((item) => !item.roles || item.roles.includes(role))
      .map((item) => {
        if (item.children?.length) {
          const children = item.children.filter((c) => {
            if (isRouteHidden(c.href, hiddenRoutes)) return false;
            return !c.roles || c.roles.includes(role);
          });
          return { ...item, children };
        }

        if (item.href && isRouteHidden(item.href, hiddenRoutes)) return null;
        return item;
      })
      .filter((item): item is NavItem => !!item);
  }, [hiddenRoutes, nav, role]);

  const isActive = (href?: string, exact?: boolean) => {
    if (!href) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const computeInitialOpen = () => {
    const open: Record<string, boolean> = {};
    for (const item of navByRole) {
      const visibleChildren = item.children ?? [];
      if (visibleChildren.some((c) => isActive(c.href, c.exact))) open[item.label] = true;
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups(computeInitialOpen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, role]);

  async function handleLogout() {
    let manualHandled = false;
    try {
      if (typeof window !== "undefined" && window.__logoutManual) {
        manualHandled = true;
        await window.__logoutManual();
      }
    } catch {}
    if (!manualHandled) {
      await forceClientLogout();
    }
    router.replace("/");
  }
  const userSubtitle = jobTitle?.trim() ? jobTitle : departmentName ? `Setor: ${departmentName}` : null;

  return (
    <aside className="sticky top-0 flex h-screen w-[280px] flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="Ocultar menu lateral"
            aria-label="Ocultar menu lateral"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companyLogoUrl}
              alt={companyName ?? "Empresa"}
              className="h-10 w-10 rounded-xl object-contain border border-slate-200 bg-white"
            />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white font-semibold">RH</div>
          )}

          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-slate-900">{companyName ?? "Portal de RH"}</div>
            <div className="text-xs text-slate-500">Portal de RH</div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {resolvedAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedAvatarUrl}
              alt={fullName ?? "Colaborador"}
              className="h-10 w-10 rounded-full object-cover border border-slate-200 bg-white"
            />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {(fullName?.trim()?.[0] ?? "U").toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{fullName ?? "Colaborador"}</p>
            {userSubtitle ? <p className="truncate text-xs text-slate-500">{userSubtitle}</p> : null}
          </div>
        </div>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3 pr-2">
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

          const visibleChildren = item.children ?? [];
          if (!visibleChildren.length) return null;

          const groupOpen = !!openGroups[item.label];
          const anyChildActive = visibleChildren.some((c) => isActive(c.href, c.exact));

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
                  {visibleChildren.map((child) => {
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

      <div className="border-t border-slate-200 p-4 bg-white">
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







