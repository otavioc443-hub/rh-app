import type {
  LmsCourseFormValues,
  LmsCourseStatus,
  LmsLesson,
  LmsProgressStatus,
} from "@/lib/lms/types";

export function slugifyCourseTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCourseStatusLabel(status: LmsCourseStatus) {
  if (status === "draft") return "Rascunho";
  if (status === "published") return "Publicado";
  return "Arquivado";
}

export function getProgressStatusLabel(status: LmsProgressStatus) {
  if (status === "not_started") return "Nao iniciado";
  if (status === "in_progress") return "Em andamento";
  if (status === "completed") return "Concluido";
  return "Vencido";
}

export function buildCourseDefaults(): LmsCourseFormValues {
  return {
    title: "",
    slug: "",
    short_description: "",
    full_description: "",
    category: "",
    thumbnail_url: "",
    banner_url: "",
    workload_hours: null,
    required: false,
    certificate_enabled: true,
    passing_score: 70,
    status: "draft",
    visibility: "publico_interno",
    sequence_required: true,
    onboarding_recommended: false,
  };
}

export function formatPercent(value: number | null | undefined) {
  return `${Math.max(0, Math.min(100, Math.round(Number(value ?? 0))))}%`;
}

export function getNextLesson(modules: Array<{ lessons: LmsLesson[] }>, currentLessonId?: string | null) {
  const flatLessons = getOrderedLessons(modules);
  if (!flatLessons.length) return null;
  if (!currentLessonId) return flatLessons[0];
  const currentIndex = flatLessons.findIndex((lesson) => lesson.id === currentLessonId);
  if (currentIndex < 0) return flatLessons[0];
  return flatLessons[currentIndex + 1] ?? null;
}

export function getOrderedLessons(modules: Array<{ lessons: LmsLesson[] }>) {
  return modules.flatMap((module) => [...module.lessons].sort((a, b) => a.sort_order - b.sort_order));
}

export function getResumeLesson(
  modules: Array<{ lessons: LmsLesson[] }>,
  currentLessonId?: string | null,
  completedLessonIds?: Set<string>,
) {
  const lessons = getOrderedLessons(modules);
  if (!lessons.length) return null;
  if (currentLessonId) {
    const currentLesson = lessons.find((lesson) => lesson.id === currentLessonId);
    if (currentLesson) return currentLesson;
  }
  if (completedLessonIds?.size) {
    const nextPending = lessons.find((lesson) => !completedLessonIds.has(lesson.id));
    if (nextPending) return nextPending;
  }
  return lessons[0];
}

export function getRequiredLessonsSummary(modules: Array<{ lessons: LmsLesson[] }>) {
  const lessons = getOrderedLessons(modules);
  const requiredLessons = lessons.filter((lesson) => lesson.is_required);
  return {
    totalLessons: lessons.length,
    requiredLessons: requiredLessons.length,
    totalMinutes: lessons.reduce((sum, lesson) => sum + (lesson.duration_minutes ?? 0), 0),
  };
}

export function buildStorageRef(bucket: string, path: string) {
  return `storage://${bucket}/${path}`;
}

export function parseStorageRef(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("storage://")) return null;
  const withoutPrefix = raw.slice("storage://".length);
  const slashIndex = withoutPrefix.indexOf("/");
  if (slashIndex <= 0) return null;
  return {
    bucket: withoutPrefix.slice(0, slashIndex),
    path: withoutPrefix.slice(slashIndex + 1),
  };
}

export function isLessonLocked(
  sequenceRequired: boolean,
  moduleGroups: Array<{ lessons: LmsLesson[] }>,
  lessonId: string,
  completedLessonIds: Set<string>,
) {
  if (!sequenceRequired) return false;
  const flatLessons = getOrderedLessons(moduleGroups);
  const index = flatLessons.findIndex((lesson) => lesson.id === lessonId);
  if (index <= 0) return false;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const previousLesson = flatLessons[cursor];
    if (previousLesson.is_required && !completedLessonIds.has(previousLesson.id)) return true;
  }
  return false;
}
