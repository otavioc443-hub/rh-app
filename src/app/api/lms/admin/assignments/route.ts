import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { createAssignment } from "@/lib/lms/server";
import type { LmsAssignmentFormValues } from "@/lib/lms/types";

export async function POST(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const body = (await request.json()) as LmsAssignmentFormValues;
  const saved = await createAssignment(access, {
    assignment_type: body.assignment_type,
    target_id: body.target_id,
    course_id: body.course_id || null,
    learning_path_id: body.learning_path_id || null,
    due_date: body.due_date || null,
    mandatory: body.mandatory,
    expires_at: body.expires_at || null,
  });
  return NextResponse.json({ id: saved.id });
}
