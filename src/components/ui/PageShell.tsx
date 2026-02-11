"use client";

import { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="p-6">{children}</div>;
}

export function PageHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start gap-4">
          {/* ✅ caixa maior e com respiro */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <div className="flex items-center justify-center">{icon}</div>
          </div>

          <div className="pt-1">
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            {icon}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-700">{label}</div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-auto">{children}</div>;
}
