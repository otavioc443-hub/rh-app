// src/lib/absence.ts
export type Role = "colaborador" | "gestor" | "rh" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  manager_id: string | null;
};

export type Allowance = {
  id: string;
  user_id: string;
  valid_from: string; // YYYY-MM-DD
  valid_to: string;   // YYYY-MM-DD
  max_days: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type AbsenceStatus = "pending_manager" | "approved" | "rejected" | "cancelled";

export type AbsenceRequest = {
  id: string;
  user_id: string;
  manager_id: string;
  allowance_id: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  days_count: number;
  reason: string | null;
  status: AbsenceStatus;
  manager_comment: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
};

export type NotificationRow = {
  id: string;
  to_user_id: string;
  title: string;
  body: string;
  link: string | null;
  type: string;
  read_at: string | null;
  created_at: string;
};

export function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseISODate(iso: string): Date {
  // iso YYYY-MM-DD
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function diffDaysInclusive(startISO: string, endISO: string): number {
  const s = parseISODate(startISO);
  const e = parseISODate(endISO);
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return !(aEnd < bStart || aStart > bEnd);
}
