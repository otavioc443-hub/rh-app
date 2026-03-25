export function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${safeValue}%` }} />
      </div>
      <div className="text-xs font-medium text-slate-500">{safeValue}% concluido</div>
    </div>
  );
}
