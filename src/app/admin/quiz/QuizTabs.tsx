import Link from "next/link";

export type QuizTabKey = "settings" | "history" | "questions";

export const QUIZ_TABS: { key: QuizTabKey; label: string }[] = [
  { key: "settings", label: "Cài đặt" },
  { key: "history", label: "Lịch sử thi" },
  { key: "questions", label: "Ngân hàng câu hỏi" },
];

/** Đường dẫn trang quản trị của một chương trình trắc nghiệm (hoặc trang con của nó). */
export function quizProgramHref(programId: string, section?: QuizTabKey) {
  return `/admin/quiz/${programId}${section ? `/${section}` : ""}`;
}

/** Tiêu đề chung của các trang Trắc nghiệm tuần + thanh tab tới 3 trang con. */
export function QuizTabs({
  programId,
  active,
  sessionsError,
}: {
  programId: string;
  active?: QuizTabKey;
  sessionsError?: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-bold text-[#173A67]">Thi trắc nghiệm hàng tuần</h1>
          <p className="text-body-md text-[#27496D]">
            Quản lý ngân hàng câu hỏi, lịch mở thi, tổng kết cộng điểm và bài viết kết quả.
          </p>
        </div>
        <Link
          className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67] transition hover:bg-[#173A67] hover:text-white"
          href="/quiz"
        >
          Xem trang thi →
        </Link>
      </div>

      <nav aria-label="Các trang trắc nghiệm tuần" className="flex flex-wrap gap-2">
        {QUIZ_TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-[#4a6b82] text-white shadow-sm"
                  : "bg-[#ecf4ff] text-[#173A67] hover:bg-[#d2dfe9]"
              }`}
              href={quizProgramHref(programId, tab.key)}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {sessionsError ? <p className="text-sm text-error">{sessionsError}</p> : null}
    </div>
  );
}
