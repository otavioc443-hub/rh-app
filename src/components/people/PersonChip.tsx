/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo } from "react";
import { resolvePortalAvatarUrl } from "@/lib/avatarUrl";

type Size = "sm" | "md";

function initialsFromName(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  const out = (a + b).toUpperCase();
  return out || "U";
}

export function PersonChip(props: {
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  size?: Size;
  className?: string;
}) {
  const size: Size = props.size ?? "md";
  const dim = size === "sm" ? 28 : 36;
  const textName = size === "sm" ? "text-xs" : "text-sm";
  const textSub = size === "sm" ? "text-[11px]" : "text-xs";

  const initials = useMemo(() => initialsFromName(props.name), [props.name]);
  const avatarUrl = useMemo(() => resolvePortalAvatarUrl(props.avatarUrl), [props.avatarUrl]);

  return (
    <div className={`flex items-center gap-3 min-w-0 ${props.className ?? ""}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={props.name}
          className="rounded-full border border-slate-200 bg-white object-cover"
          style={{ width: dim, height: dim }}
        />
      ) : (
        <div
          className="grid place-items-center rounded-full bg-slate-900 font-semibold text-white shrink-0"
          style={{ width: dim, height: dim, fontSize: size === "sm" ? 10 : 12 }}
        >
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <div className={`truncate font-semibold text-slate-900 ${textName}`}>{props.name}</div>
        {props.subtitle ? <div className={`truncate text-slate-500 ${textSub}`}>{props.subtitle}</div> : null}
      </div>
    </div>
  );
}
