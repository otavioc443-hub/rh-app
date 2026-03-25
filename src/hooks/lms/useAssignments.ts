"use client";

import { useState } from "react";
import { assignmentsService } from "@/lib/lms/assignmentsService";
import type { LmsAssignmentFormValues } from "@/lib/lms/types";

export function useAssignments() {
  const [saving, setSaving] = useState(false);

  async function createAssignment(payload: LmsAssignmentFormValues) {
    setSaving(true);
    try {
      return await assignmentsService.create(payload);
    } finally {
      setSaving(false);
    }
  }

  return { saving, createAssignment };
}
