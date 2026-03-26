"use client";

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
}: {
  detail: LmsCourseDetail;
  expandedModuleId: string | null;
  onToggle: (moduleId: string) => void;
  completedLessonIds?: Set<string>;
  isLessonLocked?: (lessonId: string) => boolean;
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
                    return (
                      <div key={lesson.id} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{lesson.title}</div>
                          <div className="text-xs text-slate-500">{lesson.lesson_type} · {lesson.duration_minutes ?? 0} min</div>
                        </div>
                        <div className="flex items-center gap-3">
                          {completedLessonIds?.has(lesson.id) ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Concluida</span> : null}
                          {locked ? <Lock size={16} className="text-slate-400" /> : null}
                        </div>
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
