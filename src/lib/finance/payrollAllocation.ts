type ProjectLike = {
  id: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
};

type MemberLike = {
  project_id: string;
  user_id: string;
  added_at?: string | null;
};

type AllocationLike = {
  project_id: string;
  user_id: string;
  allocation_pct: number | null;
  created_at?: string | null;
};

type PayrollCost = {
  monthlyAverage: number;
  totalCost: number;
  months: number;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthEnd(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function countMonthsInclusive(start: Date, end: Date) {
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
}

function eachMonth(start: Date, end: Date) {
  const out: Date[] = [];
  const c = monthStart(start);
  const e = monthStart(end);
  while (c <= e) {
    out.push(new Date(c));
    c.setMonth(c.getMonth() + 1);
  }
  return out;
}

export function computePayrollAllocationByProject(params: {
  projects: ProjectLike[];
  members: MemberLike[];
  allocations: AllocationLike[];
  salaryByUserId: Record<string, number>;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
}) {
  const { projects, members, allocations, salaryByUserId, rangeStart = null, rangeEnd = null } = params;
  const projectIdSet = new Set(projects.map((p) => p.id));
  const scopedMembers = members.filter((m) => projectIdSet.has(m.project_id));
  const scopedAllocs = allocations.filter((a) => projectIdSet.has(a.project_id));

  const membersByUser = new Map<string, Array<{ projectId: string; addedAt: Date | null }>>();
  for (const m of scopedMembers) {
    const list = membersByUser.get(m.user_id) ?? [];
    list.push({ projectId: m.project_id, addedAt: parseDate(m.added_at ?? null) });
    membersByUser.set(m.user_id, list);
  }

  const allocsByUser = new Map<string, Array<{ projectId: string; pct: number; createdAt: Date | null }>>();
  for (const a of scopedAllocs) {
    const pct = Math.max(0, Number(a.allocation_pct) || 0);
    if (pct <= 0) continue;
    const list = allocsByUser.get(a.user_id) ?? [];
    list.push({ projectId: a.project_id, pct, createdAt: parseDate(a.created_at ?? null) });
    allocsByUser.set(a.user_id, list);
  }

  const result = new Map<string, PayrollCost>();

  for (const p of projects) {
    const baseStart = parseDate(p.start_date ?? null) ?? parseDate(p.created_at ?? null) ?? new Date();
    const baseEnd = parseDate(p.end_date ?? null) ?? new Date();
    const effStart = rangeStart && rangeStart > baseStart ? rangeStart : baseStart;
    const effEnd = rangeEnd && rangeEnd < baseEnd ? rangeEnd : baseEnd;
    if (effStart > effEnd) {
      result.set(p.id, { monthlyAverage: 0, totalCost: 0, months: 0 });
      continue;
    }

    const months = eachMonth(effStart, effEnd);
    let total = 0;

    for (const mStart of months) {
      const mEnd = monthEnd(mStart);
      let monthCost = 0;

      for (const [userId, salary] of Object.entries(salaryByUserId)) {
        const baseSalary = Number(salary) || 0;
        if (baseSalary <= 0) continue;

        const userAllocs = (allocsByUser.get(userId) ?? []).filter((a) => !a.createdAt || a.createdAt <= mEnd);
        if (userAllocs.length > 0) {
          const totalPct = userAllocs.reduce((acc, a) => acc + a.pct, 0);
          if (totalPct <= 0) continue;
          const myPct = userAllocs
            .filter((a) => a.projectId === p.id)
            .reduce((acc, a) => acc + a.pct, 0);
          if (myPct > 0) monthCost += baseSalary * (myPct / totalPct);
          continue;
        }

        const userMembers = (membersByUser.get(userId) ?? []).filter((x) => !x.addedAt || x.addedAt <= mEnd);
        const activeProjects = userMembers.map((x) => x.projectId);
        if (!activeProjects.length) continue;
        if (!activeProjects.includes(p.id)) continue;
        monthCost += baseSalary / activeProjects.length;
      }

      total += monthCost;
    }

    const monthsCount = countMonthsInclusive(monthStart(effStart), monthStart(effEnd));
    result.set(p.id, {
      monthlyAverage: monthsCount > 0 ? total / monthsCount : 0,
      totalCost: total,
      months: monthsCount,
    });
  }

  return result;
}

