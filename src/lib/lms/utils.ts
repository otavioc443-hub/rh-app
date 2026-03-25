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
  const flatLessons = modules.flatMap((module) => [...module.lessons].sort((a, b) => a.sort_order - b.sort_order));
  if (!flatLessons.length) return null;
  if (!currentLessonId) return flatLessons[0];
  const currentIndex = flatLessons.findIndex((lesson) => lesson.id === currentLessonId);
  if (currentIndex < 0) return flatLessons[0];
  return flatLessons[currentIndex + 1] ?? null;
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
  const flatLessons = moduleGroups.flatMap((module) => [...module.lessons].sort((a, b) => a.sort_order - b.sort_order));
  const index = flatLessons.findIndex((lesson) => lesson.id === lessonId);
  if (index <= 0) return false;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const previousLesson = flatLessons[cursor];
    if (previousLesson.is_required && !completedLessonIds.has(previousLesson.id)) return true;
  }
  return false;
}
