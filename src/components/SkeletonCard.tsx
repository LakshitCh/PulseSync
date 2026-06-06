/** Shimmer skeleton card — displayed during playlist generation */
export default function SkeletonCard() {
  return (
    <div className="bg-white/60 border border-stone-200 rounded-2xl p-4 overflow-hidden">
      <div className="flex items-start gap-4">
        {/* Score ring skeleton */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-5 h-2 bg-stone-200 rounded animate-shimmer" />
          <div className="w-14 h-14 rounded-full bg-stone-100 animate-shimmer" />
        </div>

        {/* Info block skeleton */}
        <div className="flex-1 space-y-2 pt-1">
          {/* Album art + title row */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-stone-200 animate-shimmer shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-stone-200 rounded-full w-3/4 animate-shimmer" />
              <div className="h-2.5 bg-stone-100 rounded-full w-1/2 animate-shimmer" />
            </div>
            <div className="w-14 h-5 bg-stone-100 rounded-full animate-shimmer shrink-0" />
          </div>

          {/* Metric bars skeleton */}
          <div className="mt-3 space-y-2">
            {[0.75, 0.55, 0.65].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-20 h-2 bg-stone-100 rounded animate-shimmer" />
                <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-stone-200 rounded-full animate-shimmer"
                    style={{ width: `${w * 100}%` }}
                  />
                </div>
                <div className="w-7 h-2 bg-stone-100 rounded animate-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-stone-200 animate-shimmer" />
          ))}
        </div>
        <div className="h-2 w-24 bg-stone-100 rounded animate-shimmer" />
      </div>
    </div>
  );
}
