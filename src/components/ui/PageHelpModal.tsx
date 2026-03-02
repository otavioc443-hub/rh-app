"use client";

import { X } from "lucide-react";

export function PageHelpModal({
  open,
  title,
  items,
  onClose,
  subtitle,
}: {
  open: boolean;
  title: string;
  items: Array<{ title?: string; text: string }>;
  onClose: () => void;
  subtitle?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
            aria-label="Fechar ajuda"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          {items.map((item, idx) => (
            <div key={`${title}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              {item.title ? <p className="font-semibold text-slate-900">{item.title}</p> : null}
              <p className={item.title ? "mt-1" : undefined}>{item.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
