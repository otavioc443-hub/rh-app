import type { LmsAssignmentFormValues } from "@/lib/lms/types";

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error?.error === "string" ? error.error : "Falha ao executar a operacao.");
  }
  return response.json() as Promise<T>;
}

export const assignmentsService = {
  async create(payload: LmsAssignmentFormValues) {
    return handleJson<{ id: string }>(
      await fetch("/api/lms/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },
};
