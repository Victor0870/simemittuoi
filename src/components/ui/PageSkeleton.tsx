type PageSkeletonProps = {
  /** grid: lưới thẻ (album); quiz: thẻ câu hỏi; table: bảng dữ liệu (văn phòng, quản trị). */
  variant?: "grid" | "quiz" | "table";
};

/** Khung chờ hiện ngay khi bấm menu, trong lúc trang động đang được dựng ở máy chủ. */
export function PageSkeleton({ variant = "table" }: PageSkeletonProps) {
  return (
    <div className="animate-pulse space-y-6 py-2" aria-busy="true" aria-label="Đang tải">
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-surface-container" />
        <div className="h-8 w-64 max-w-full rounded-lg bg-surface-container" />
        <div className="h-4 w-96 max-w-full rounded bg-surface-container" />
      </div>

      {variant === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-dusty-border/60">
              <div className="aspect-[4/3] bg-surface-container" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-surface-container" />
                <div className="h-3 w-1/2 rounded bg-surface-container" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {variant === "quiz" ? (
        <>
          <div className="h-28 rounded-3xl bg-surface-container" />
          <div className="space-y-3 rounded-3xl border border-dusty-border/60 p-5">
            <div className="h-5 w-2/3 rounded bg-surface-container" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-11 rounded-xl bg-surface-container" />
            ))}
          </div>
        </>
      ) : null}

      {variant === "table" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="h-10 w-56 max-w-full rounded-xl bg-surface-container" />
            <div className="h-10 w-32 rounded-xl bg-surface-container" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-dusty-border/60">
            <div className="h-11 bg-surface-container" />
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex gap-4 border-t border-dusty-border/40 px-4 py-3">
                <div className="h-4 w-1/4 rounded bg-surface-container" />
                <div className="h-4 w-1/3 rounded bg-surface-container" />
                <div className="h-4 w-1/6 rounded bg-surface-container" />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
