import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { QuizPlayClient } from "@/components/quiz/QuizPlayClient";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { computeSessionRanking, getDisplaySession, getQuizStatus, loadQuizProgram, loadQuizSettings } from "@/lib/quiz";
import { describePointRules, WEEKLY_QUIZ_PROGRAM_ID } from "@/lib/quiz-shared";
import { getSessionUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QuizProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const [supabase, userId] = await Promise.all([createClient(), getSessionUserId()]);

  const db = createServiceClient();
  // Chỉ đọc chương trình và cấu hình, chạy song song với hồ sơ
  const programPromise = loadQuizProgram(db, programId);
  const settingsPromise = loadQuizSettings(db, programId);
  programPromise.catch(() => {});
  settingsPromise.catch(() => {});

  let isApproved = false;
  let isAdmin = false;
  if (userId) {
    const { data: me } = await supabase
      .from(CDILV_TABLE.profiles)
      .select("approval_status, role")
      .eq("id", userId)
      .maybeSingle();
    isApproved = me?.approval_status === "approved";
    isAdmin = me?.role === "admin" && isApproved;
  }

  const program = await programPromise;
  if (!program || (!program.is_active && !isAdmin)) notFound();
  const isWeekly = program.id === WEEKLY_QUIZ_PROGRAM_ID;

  const status = await getQuizStatus(db, program, isApproved && userId ? userId : null);
  const settings = await settingsPromise;
  const displaySession = await getDisplaySession(db, program.id);
  const board = displaySession
    ? await computeSessionRanking(db, displaySession.id, settings)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Link className="inline-flex items-center gap-1 text-sm font-semibold text-[#173A67] hover:underline" href="/quiz">
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Tất cả chương trình trắc nghiệm
      </Link>

      {!program.is_active ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Chương trình đang Inactive — chỉ Quản trị viên xem được trang này.
        </p>
      ) : null}

      <div className="rounded-3xl bg-gradient-to-br from-[#173A67] via-[#1E4A7D] to-[#27496D] p-5 text-white shadow-md sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <MaterialIcon className="text-[28px]" name="quiz" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold sm:text-2xl">
              {isWeekly ? "Thi trắc nghiệm hàng tuần" : program.name}
            </h1>
            <p className="whitespace-pre-line text-sm text-white/80">
              {isWeekly || !program.description
                ? "Trả lời nhanh và chính xác để lọt vào bảng xếp hạng, nhận điểm thi đua."
                : program.description}
            </p>
          </div>
        </div>
      </div>

      <QuizPlayClient
        initialStatus={status}
        isApproved={isApproved}
        isLoggedIn={Boolean(userId)}
        pointRules={describePointRules(settings)}
        isAdmin={isAdmin}
        programId={program.id}
      />

      {displaySession && board ? (
        <QuizLeaderboard
          currentUserId={userId}
          finalized={Boolean(displaySession.finalized_at)}
          isOpen={status.session?.id === displaySession.id}
          participantsCount={board.participantsCount}
          ranking={board.ranking}
          resultPostId={displaySession.result_post_id}
          title={displaySession.title}
          totalQuestions={settings.questions_per_attempt}
          isAdmin={isAdmin}
          sessionId={displaySession.id}
        />
      ) : null}
    </div>
  );
}
