import Link from "next/link";
import { AdminBreadcrumbTrail } from "@/components/admin/AdminBreadcrumbTrail";
import type { QuizProgramRow } from "@/lib/quiz-shared";

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

/** Tiêu đề chung của các trang một chương trình trắc nghiệm + thanh tab tới 3 trang con + breadcrumb. */
export function QuizTabs({
  program,
  active,
  sessionsError,
}: {
  program: Pick<QuizProgramRow, "id" | "name" | "is_active">;
  active?: QuizTabKey;
  sessionsError?: string | null;
}) {
  const activeTab = QUIZ_TABS.find((t) => t.key === active);
  const trail = [{ label: program.name, href: quizProgramHref(program.id) }];
  if (activeTab) trail.push({ label: activeTab.label, href: quizProgramHref(program.id, activeTab.key) });

  return (
    <div className="space-y-4">
      <AdminBreadcrumbTrail items={trail} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-headline-md font-bold text-[#173A67]">{program.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                program.is_active ? "bg-emerald-100 text-emerald-800" : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {program.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-body-md text-[#27496D]">
            Quản lý ngân hàng câu hỏi, lịch mở thi, tổng kết cộng điểm và bài viết kết quả.
          </p>
        </div>
        <Link
          className="rounded-xl border-2 border-[#173A67] px-4 py-2 font-bold text-[#173A67] transition hover:bg-[#173A67] hover:text-white"
          href={`/quiz/${program.id}`}
        >
          Xem trang thi →
        </Link>
      </div>

      <nav aria-label="Các trang của chương trình trắc nghiệm" className="flex flex-wrap gap-2">
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
              href={quizProgramHref(program.id, tab.key)}
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
