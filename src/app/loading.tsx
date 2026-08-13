export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 py-2" aria-busy="true" aria-label="Đang tải">
      <div className="h-40 rounded-3xl bg-surface-container md:h-56" />
      <div className="h-48 rounded-3xl bg-surface-container" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 rounded-3xl bg-surface-container" />
        <div className="h-32 rounded-3xl bg-surface-container" />
      </div>
    </div>
  );
}
