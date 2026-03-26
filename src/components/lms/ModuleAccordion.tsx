"use client";

import Link from "next/link";
import { ChevronDown, Lock } from "lucide-react";
import type { LmsCourseDetail } from "@/lib/lms/types";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ModuleAccordion({
  detail,
  expandedModuleId,
  onToggle,
  completedLessonIds,
  isLessonLocked,
  currentLessonId,
  lessonHrefBuilder,
}: {
  detail: LmsCourseDetail;
  expandedModuleId: string | null;
  onToggle: (moduleId: string) => void;
  completedLessonIds?: Set<string>;
  isLessonLocked?: (lessonId: string) => boolean;
  currentLessonId?: string | null;
  lessonHrefBuilder?: (lessonId: string) => string;
}) {
  return (
    <div className="space-y-4">
      {detail.modules.map((module) => {
        const open = expandedModuleId === module.id;
        return (
          <div key={module.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <button type="button" className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => onToggle(module.id)}>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fase {module.sort_order}</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{module.title}</h3>
                {module.description ? <p className="mt-1 text-sm text-slate-500">{module.description}</p> : null}
              </div>
              <ChevronDown size={18} className={cx("transition-transform", open && "rotate-180")} />
            </button>
            {open ? (
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="space-y-3">
                  {module.lessons.map((lesson) => {
                    const locked = isLessonLocked?.(lesson.id) ?? false;
                    const selected = currentLessonId === lesson.id;
                    const className = cx(
                      "flex items-center justify-between rounded-2xl border px-4 py-3",
                      selected ? "border-slate-900 bg-slate-50" : "border-slate-100",
                      lessonHrefBuilder && !locked && "transition hover:border-slate-300 hover:bg-slate-50",
                    );

                    const content = (
                      <>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{lesson.title}</div>
                          <div className="text-xs capitalize text-slate-500">
                            {lesson.lesson_type} · {lesson.duration_minutes ?? 0} min
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {completedLessonIds?.has(lesson.id) ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Concluida</span>
                          ) : null}
                          {locked ? <Lock size={16} className="text-slate-400" /> : null}
                        </div>
                      </>
                    );

                    if (lessonHrefBuilder && !locked) {
                      return (
                        <Link key={lesson.id} href={lessonHrefBuilder(lesson.id)} className={className}>
                          {content}
                        </Link>
                      );
                    }

                    return (
                      <div key={lesson.id} className={className}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
