import type { LmsCourseEditorPayload } from "@/lib/lms/types";

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error?.error === "string" ? error.error : "Falha ao executar a operacao.");
  }
  return response.json() as Promise<T>;
}

export const coursesService = {
  async save(courseId: string | null, payload: LmsCourseEditorPayload) {
    const url = courseId ? `/api/lms/admin/courses/${courseId}` : "/api/lms/admin/courses";
    const method = courseId ? "PATCH" : "POST";
    return handleJson<{ id: string }>(
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },
  async archive(courseId: string) {
    return handleJson<{ success: true }>(
      await fetch(`/api/lms/admin/courses/${courseId}`, {
        method: "DELETE",
      }),
    );
  },
};
