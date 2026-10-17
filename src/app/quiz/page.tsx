import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { QuizPlayClient } from "@/components/quiz/QuizPlayClient";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { computeSessionRanking, getDisplaySession, getQuizStatus, loadQuizSettings } from "@/lib/quiz";
import { describePointRules } from "@/lib/quiz-shared";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QuizPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isApproved = false;
  if (user) {
    const { data: me } = await supabase
      .from(CDILV_TABLE.profiles)
      .select("approval_status")
      .eq("id", user.id)
      .maybeSingle();
    isApproved = me?.approval_status === "approved";
  }

  const db = createServiceClient();
  const status = await getQuizStatus(db, isApproved && user ? user.id : null);
  const settings = await loadQuizSettings(db);
  const displaySession = await getDisplaySession(db);
  const board = displaySession
    ? await computeSessionRanking(db, displaySession.id, settings)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className="rounded-3xl bg-gradient-to-br from-[#173A67] via-[#1E4A7D] to-[#27496D] p-5 text-white shadow-md sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <MaterialIcon className="text-[28px]" name="quiz" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold sm:text-2xl">Thi trắc nghiệm hàng tuần</h1>
            <p className="text-sm text-white/80">
              Trả lời nhanh và chính xác để lọt vào bảng xếp hạng, nhận điểm thi đua.
            </p>
          </div>
        </div>
      </div>

      <QuizPlayClient
        initialStatus={status}
        isApproved={isApproved}
        isLoggedIn={Boolean(user)}
        pointRules={describePointRules(settings)}
      />

      {displaySession && board ? (
        <QuizLeaderboard
          currentUserId={user?.id ?? null}
          finalized={Boolean(displaySession.finalized_at)}
          isOpen={status.session?.id === displaySession.id}
          participantsCount={board.participantsCount}
          ranking={board.ranking}
          resultPostId={displaySession.result_post_id}
          title={displaySession.title}
          totalQuestions={settings.questions_per_attempt}
        />
      ) : null}
    </div>
  );
}
