import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

type DiretoriaPageHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export default function DiretoriaPageHeader({ icon: Icon, title, subtitle, action }: DiretoriaPageHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
            <Icon size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

