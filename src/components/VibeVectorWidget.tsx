import type { NormalizedVector } from "@/lib/vectorEngine";

interface VibeVectorWidgetProps {
  /** Already-computed centroid (normalized) */
  vector: NormalizedVector;
  /** Raw average BPM (for display — before normalization) */
  avgBpm: number;
}

/** Live-updating vibe vector widget shown while seeds are selected */
export default function VibeVectorWidget({ vector, avgBpm }: VibeVectorWidgetProps) {
  const stats = [
    {
      label: "Avg BPM",
      value: `${Math.round(avgBpm)}`,
      raw: vector.bpm,
    },
    {
      label: "Energy",
      value: `${Math.round(vector.energy * 100)}%`,
      raw: vector.energy,
    },
    {
      label: "Valence",
      value: `${Math.round(vector.valence * 100)}%`,
      raw: vector.valence,
    },
    {
      label: "Danceability",
      value: `${Math.round(vector.danceability * 100)}%`,
      raw: vector.danceability,
    },
  ];

  return (
    <div className="bg-terracotta/8 border border-terracotta/25 rounded-2xl p-4 animate-fade-in">
      <p className="text-xs font-bold uppercase tracking-widest text-terracotta mb-3">
        Target Vibe Vector
      </p>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-stone-500">{s.label}</span>
              <span className="text-xs font-bold text-stone-700">{s.value}</span>
            </div>
            <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-terracotta rounded-full transition-all duration-700"
                style={{ width: `${Math.min(s.raw * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
