export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 rounded-lg bg-line/70" />
      <div className="h-4 w-96 max-w-full rounded bg-line/50" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-[var(--radius-card)] bg-line/40" />
        ))}
      </div>
      <div className="h-72 rounded-[var(--radius-card)] bg-line/40" />
    </div>
  );
}
