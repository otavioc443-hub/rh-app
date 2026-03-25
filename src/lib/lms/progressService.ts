async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error?.error === "string" ? error.error : "Falha ao atualizar progresso.");
  }
  return response.json() as Promise<T>;
}

export const progressService = {
  async completeLesson(courseId: string, lessonId: string, completed = true) {
    return handleJson<{ progressPercent: number; status: string }>(
      await fetch("/api/lms/progress/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId, completed }),
      }),
    );
  },
};
