/** Animated audio feature progress bar */
export default function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs font-medium text-stone-500 uppercase tracking-wide shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 text-xs font-semibold text-stone-600 text-right">
        {pct}%
      </span>
    </div>
  );
}
