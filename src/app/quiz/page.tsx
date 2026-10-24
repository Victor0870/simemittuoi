import Link from "next/link";
import { QuizProgramCard, type QuizProgramCardData } from "@/components/quiz/QuizProgramCard";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { isInAutoWindow, loadQuizPrograms, loadQuizSettings, nextAutoStart } from "@/lib/quiz";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const revalidate = 30;

/** Lưới 2 cột; khi chỉ có 1 chương trình thì thẻ giữ bề rộng 1 cột và nằm giữa. */
function ProgramGrid({ programs }: { programs: QuizProgramCardData[] }) {
  if (programs.length === 1) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <div className="mx-auto w-full md:max-w-[calc(50%-12px)]">
          <QuizProgramCard program={programs[0]} />
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {programs.map((p) => (
        <QuizProgramCard key={p.id} program={p} />
      ))}
    </div>
  );
}

export default async function QuizProgramsPage() {
  const db = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const programs = (await loadQuizPrograms(db)).filter((p) => p.is_active);
  const [settingsList, { data: openSessions, error }] = await Promise.all([
    Promise.all(programs.map((p) => loadQuizSettings(db, p.id))),
    db
      .from(CDILV_TABLE.quizSessions)
      .select("program_id, ends_at")
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso),
  ]);
  if (error) throw error;

  const cards: QuizProgramCardData[] = programs.map((p, i) => {
    const settings = settingsList[i];
    const open = (openSessions ?? []).find((s) => s.program_id === p.id);
    const isOpen = Boolean(open) || isInAutoWindow(settings, now);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      isOpen,
      openEndsAt: (open?.ends_at as string | undefined) ?? null,
      nextStartAt: isOpen ? null : (nextAutoStart(settings, now)?.toISOString() ?? null),
      settings,
    };
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-4 sm:gap-4 sm:pb-6">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="rounded-xl bg-primary/10 p-1.5 text-primary sm:p-2">
            <MaterialIcon className="text-[22px] sm:text-[28px]" name="quiz" />
          </div>
          <div>
            <h1 className="text-title-lg font-extrabold tracking-tight text-[#173A67] sm:text-headline-lg">
              Thi Trắc Nghiệm
            </h1>
            <p className="text-xs text-on-surface-variant sm:text-body-md">
              Chọn chương trình để làm bài, xem bảng xếp hạng và nhận điểm thi đua
            </p>
          </div>
        </div>
        <Link
          className="rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold text-[#173A67] transition hover:bg-surface-container-high sm:px-4 sm:py-2 sm:text-label-md"
          href="/"
        >
          ← Về trang chủ
        </Link>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-12 text-center">
          <MaterialIcon className="mx-auto mb-3 text-[48px] text-on-surface-variant/40" name="inbox" />
          <h3 className="text-title-md font-bold text-[#173A67]">Chưa có chương trình trắc nghiệm nào</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Ban Chấp hành Công đoàn sẽ sớm công bố các chương trình thi mới tại đây.
          </p>
        </div>
      ) : (
        <ProgramGrid programs={cards} />
      )}
    </div>
  );
}
