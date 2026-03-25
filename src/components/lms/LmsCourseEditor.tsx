"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageShell";
import { FileUploader } from "@/components/lms/FileUploader";
import { coursesService } from "@/lib/lms/coursesService";
import { buildCourseDefaults } from "@/lib/lms/utils";
import type { LmsCourseEditorPayload, LmsQuizPayload } from "@/lib/lms/types";

type EditorData = {
  course?: Record<string, unknown>;
  modules?: Array<Record<string, unknown>>;
  quiz?: LmsQuizPayload | null;
};

export function LmsCourseEditor({ mode, courseId, initialData }: { mode: "create" | "edit"; courseId: string | null; initialData?: EditorData | null }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<LmsCourseEditorPayload>({
    ...buildCourseDefaults(),
    ...(initialData?.course ?? {}),
    modules: (initialData?.modules as LmsCourseEditorPayload["modules"] | undefined) ?? [
      {
        title: "Modulo 1",
        description: "",
        sort_order: 1,
        lessons: [
          {
            title: "Aula 1",
            description: "",
            lesson_type: "texto",
            content_url: "",
            content_text: "<p>Conteudo inicial da aula.</p>",
            duration_minutes: 15,
            sort_order: 1,
            is_required: true,
            allow_preview: false,
          },
        ],
      },
    ],
    quiz: initialData?.quiz
      ? {
          id: initialData.quiz.quiz.id,
          title: initialData.quiz.quiz.title,
          passing_score: initialData.quiz.quiz.passing_score,
          max_attempts: initialData.quiz.quiz.max_attempts,
          randomize_questions: initialData.quiz.quiz.randomize_questions,
          questions: initialData.quiz.questions.map((question) => ({
            id: question.id,
            statement: question.statement,
            question_type: question.question_type,
            sort_order: question.sort_order,
            options: question.options.map((option) => ({ id: option.id, text: option.text, is_correct: option.is_correct })),
          })),
        }
      : null,
  });

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await coursesService.save(courseId, form);
      router.push("/rh/lms/cursos");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar curso.");
    } finally {
      setSaving(false);
    }
  }

  const firstLesson = form.modules[0]?.lessons[0];

  return (
    <div className="space-y-6">
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title={mode === "create" ? "Novo curso" : "Editar curso"} subtitle="Estruture o treinamento, modulos, aulas e avaliacao." />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Titulo do curso" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
            <input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="slug-do-curso" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
            <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Categoria" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
            <input type="number" value={form.workload_hours ?? ""} onChange={(event) => setForm((current) => ({ ...current, workload_hours: Number(event.target.value) || null }))} placeholder="Carga horaria" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
          </div>
          <textarea value={form.short_description} onChange={(event) => setForm((current) => ({ ...current, short_description: event.target.value }))} placeholder="Resumo do curso" className="min-h-[90px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
          <textarea value={form.full_description} onChange={(event) => setForm((current) => ({ ...current, full_description: event.target.value }))} placeholder="Descricao completa" className="min-h-[180px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
          <div className="grid gap-4 md:grid-cols-3">
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as typeof current.status }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
            <select value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as typeof current.visibility }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
              <option value="publico_interno">Publico interno</option>
              <option value="restrito">Restrito</option>
            </select>
            <input type="number" value={form.passing_score ?? ""} onChange={(event) => setForm((current) => ({ ...current, passing_score: Number(event.target.value) || null }))} placeholder="Nota minima" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-100 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.required} onChange={(event) => setForm((current) => ({ ...current, required: event.target.checked }))} />
              Obrigatorio
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-100 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.certificate_enabled} onChange={(event) => setForm((current) => ({ ...current, certificate_enabled: event.target.checked }))} />
              Emite certificado
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-100 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.sequence_required} onChange={(event) => setForm((current) => ({ ...current, sequence_required: event.target.checked }))} />
              Sequencia obrigatoria
            </label>
          </div>
          <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Estrutura do curso</h2>
            {form.modules.map((module, moduleIndex) => (
              <div key={`${module.title}-${moduleIndex}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <input value={module.title} onChange={(event) => setForm((current) => ({ ...current, modules: current.modules.map((item, index) => (index === moduleIndex ? { ...item, title: event.target.value } : item)) }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
                <textarea value={module.description} onChange={(event) => setForm((current) => ({ ...current, modules: current.modules.map((item, index) => (index === moduleIndex ? { ...item, description: event.target.value } : item)) }))} placeholder="Descricao do modulo" className="min-h-[72px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                {module.lessons.map((lesson, lessonIndex) => (
                  <div key={`${lesson.title}-${lessonIndex}`} className="grid gap-3 rounded-2xl border border-slate-100 p-4">
                    <input value={lesson.title} onChange={(event) => setForm((current) => ({ ...current, modules: current.modules.map((item, index) => index === moduleIndex ? { ...item, lessons: item.lessons.map((currentLesson, currentLessonIndex) => currentLessonIndex === lessonIndex ? { ...currentLesson, title: event.target.value } : currentLesson) } : item) }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
                    <select value={lesson.lesson_type} onChange={(event) => setForm((current) => ({ ...current, modules: current.modules.map((item, index) => index === moduleIndex ? { ...item, lessons: item.lessons.map((currentLesson, currentLessonIndex) => currentLessonIndex === lessonIndex ? { ...currentLesson, lesson_type: event.target.value as typeof currentLesson.lesson_type } : currentLesson) } : item) }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
                      <option value="texto">Texto</option>
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                      <option value="arquivo">Arquivo</option>
                      <option value="link">Link</option>
                      <option value="avaliacao">Avaliacao</option>
                    </select>
                    <textarea value={lesson.content_text} onChange={(event) => setForm((current) => ({ ...current, modules: current.modules.map((item, index) => index === moduleIndex ? { ...item, lessons: item.lessons.map((currentLesson, currentLessonIndex) => currentLessonIndex === lessonIndex ? { ...currentLesson, content_text: event.target.value } : currentLesson) } : item) }))} placeholder="Conteudo textual ou instrucoes" className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={lesson.is_required} onChange={(event) => setForm((current) => ({ ...current, modules: current.modules.map((item, index) => index === moduleIndex ? { ...item, lessons: item.lessons.map((currentLesson, currentLessonIndex) => currentLessonIndex === lessonIndex ? { ...currentLesson, is_required: event.target.checked } : currentLesson) } : item) }))} />
                        Aula obrigatoria
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={lesson.allow_preview} onChange={(event) => setForm((current) => ({ ...current, modules: current.modules.map((item, index) => index === moduleIndex ? { ...item, lessons: item.lessons.map((currentLesson, currentLessonIndex) => currentLessonIndex === lessonIndex ? { ...currentLesson, allow_preview: event.target.checked } : currentLesson) } : item) }))} />
                        Liberar preview
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar curso"}
            </button>
            {message ? <span className="text-sm text-rose-600">{message}</span> : null}
          </div>
        </div>
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Arquivos do curso</h2>
            <div className="mt-4 space-y-4">
              <FileUploader bucket="lms-thumbnails" label="Thumbnail" accept="image/*" onUploaded={(value) => setForm((current) => ({ ...current, thumbnail_url: value }))} />
              <FileUploader bucket="lms-banners" label="Banner" accept="image/*" onUploaded={(value) => setForm((current) => ({ ...current, banner_url: value }))} />
              <FileUploader bucket={firstLesson?.lesson_type === "video" ? "lms-videos" : "lms-materials"} label="Material da primeira aula" accept="video/*,.pdf,.doc,.docx,.ppt,.pptx" onUploaded={(value) => setForm((current) => ({ ...current, modules: current.modules.map((module, index) => index === 0 ? { ...module, lessons: module.lessons.map((lesson, lessonIndex) => lessonIndex === 0 ? { ...lesson, content_url: value } : lesson) } : module) }))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
