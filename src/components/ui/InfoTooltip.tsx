"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";

export function InfoTooltip({ title, body }: { title: string; body: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => {
          setTimeout(() => {
            const activeEl = document.activeElement;
            if (!(activeEl instanceof HTMLElement) || !activeEl.closest(`[data-tooltip="${title}"]`)) {
              setOpen(false);
            }
          }, 0);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Ajuda sobre ${title}`}
        aria-expanded={open}
      >
        <CircleHelp size={16} />
      </button>
      <div
        data-tooltip={title}
        className={`absolute right-0 top-7 z-20 w-80 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg ${
          open ? "block" : "hidden group-hover:block"
        }`}
      >
        <p className="font-semibold text-slate-800">{title}</p>
        {body.map((line, idx) => (
          <p key={`${title}-${idx}`} className="mt-1">
            {line}
          </p>
        ))}
        <div className="mt-2 flex justify-end sm:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

