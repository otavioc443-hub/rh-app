import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { createAssignment } from "@/lib/lms/server";
import type { LmsAssignmentFormValues } from "@/lib/lms/types";

function normalizeDateInput(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return normalized;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export async function POST(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const body = (await request.json()) as LmsAssignmentFormValues;
  const saved = await createAssignment(access, {
    assignment_type: body.assignment_type,
    target_id: body.target_id,
    course_id: body.course_id || null,
    learning_path_id: body.learning_path_id || null,
    due_date: normalizeDateInput(body.due_date),
    mandatory: body.mandatory,
    expires_at: normalizeDateInput(body.expires_at),
    recurring_every_days: body.recurring_every_days ? Number(body.recurring_every_days) : null,
    auto_reassign_on_expiry: body.auto_reassign_on_expiry,
  });
  return NextResponse.json({ id: saved.id });
}
