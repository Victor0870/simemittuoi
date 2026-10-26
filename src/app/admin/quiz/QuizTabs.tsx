import Link from "next/link";
import { AdminBreadcrumbTrail } from "@/components/admin/AdminBreadcrumbTrail";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { QuizProgramRow } from "@/lib/quiz-shared";

export type QuizTabKey = "settings" | "history" | "questions";

export const QUIZ_TABS: { key: QuizTabKey; label: string; icon: string }[] = [
  { key: "settings", label: "Cài đặt", icon: "tune" },
  { key: "history", label: "Lịch sử thi", icon: "history" },
  { key: "questions", label: "Ngân hàng câu hỏi", icon: "library_books" },
];

/** Bố cục gọn của 3 trang con: từ lg trở lên vừa một màn hình (trừ thanh tiêu đề 64px + lề main 2×28px). */
export const QUIZ_COMPACT_PAGE = "flex flex-col gap-3 lg:h-[calc(100dvh-120px)] lg:min-h-0 lg:overflow-hidden";

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
    <>
      <AdminBreadcrumbTrail items={trail} />
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1
          className="text-lg font-extrabold text-[#173A67]"
          title="Quản lý ngân hàng câu hỏi, lịch mở thi, tổng kết cộng điểm và bài viết kết quả."
        >
          {program.name}
        </h1>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            program.is_active ? "bg-emerald-100 text-emerald-800" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {program.is_active ? "Active" : "Inactive"}
        </span>
        <nav aria-label="Các trang của chương trình trắc nghiệm" className="flex flex-wrap items-center gap-1.5">
          {QUIZ_TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                prefetch={false}
                key={tab.key}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-[#4a6b82] bg-[#4a6b82] text-white"
                    : "border-[#d2dfe9] bg-white text-[#4a6b82] hover:bg-[#ecf4ff] hover:text-[#173A67]"
                }`}
                href={quizProgramHref(program.id, tab.key)}
              >
                <MaterialIcon className="text-[14px]" name={tab.icon} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          prefetch={false}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#173A67] px-2 py-0.5 text-xs font-bold text-[#173A67] transition hover:bg-[#173A67] hover:text-white"
          href={`/quiz/${program.id}`}
        >
          Xem trang thi
          <MaterialIcon className="text-[14px]" name="open_in_new" />
        </Link>
      </div>

      {sessionsError ? <p className="shrink-0 text-sm text-error">{sessionsError}</p> : null}
    </>
  );
}
