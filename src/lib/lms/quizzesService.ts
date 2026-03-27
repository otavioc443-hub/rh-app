async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error?.error === "string" ? error.error : "Falha ao enviar quiz.");
  }
  return response.json() as Promise<T>;
}

export const quizzesService = {
  async submit(quizId: string, answers: Record<string, string[]>) {
    return handleJson<{
      score: number;
      passed: boolean;
      requiresManualReview?: boolean;
      showScoreOnSubmit?: boolean;
      showCorrectAnswers?: boolean;
    }>(
      await fetch(`/api/lms/quizzes/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }),
    );
  },
};
