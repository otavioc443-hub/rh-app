"use client";

import { useState } from "react";
import { progressService } from "@/lib/lms/progressService";

export function useUserProgress(initialProgressPercent: number) {
  const [progressPercent, setProgressPercent] = useState(initialProgressPercent);
  const [loading, setLoading] = useState(false);

  async function completeLesson(courseId: string, lessonId: string, completed = true) {
    setLoading(true);
    try {
      const result = await progressService.completeLesson(courseId, lessonId, completed);
      setProgressPercent(result.progressPercent);
      return result;
    } finally {
      setLoading(false);
    }
  }

  return { progressPercent, loading, completeLesson };
}
