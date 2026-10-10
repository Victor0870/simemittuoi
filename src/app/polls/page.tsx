import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { PollCard } from "@/components/polls/PollCard";
import { getPolls } from "@/lib/data/polls";

export const revalidate = 30;

export default async function PollsPage() {
  const polls = await getPolls();

  const openPolls = polls.filter((p) => p.status === "open");
  const closedPolls = polls.filter((p) => p.status === "closed");

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-outline-variant pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="rounded-xl bg-amber-500/15 p-1.5 sm:p-2 text-amber-700">
              <MaterialIcon className="text-[22px] sm:text-[28px]" name="how_to_vote" />
            </div>
            <div>
              <h1 className="text-title-lg sm:text-headline-lg font-extrabold tracking-tight text-[#173A67]">
                Chương Trình Bình Chọn
              </h1>
              <p className="text-xs sm:text-body-md text-on-surface-variant">
                Bình chọn các cuộc thi, phong trào và dự đoán kết quả nhận điểm thưởng
              </p>
            </div>
          </div>
        </div>

        <Link
          className="rounded-xl border border-outline-variant bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-label-md font-bold text-[#173A67] hover:bg-surface-container-high transition"
          href="/"
        >
          ← Về trang chủ
        </Link>
      </header>

      {/* Main content */}
      {polls.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-12 text-center">
          <MaterialIcon className="text-[48px] text-on-surface-variant/40 mx-auto mb-3" name="inbox" />
          <h3 className="text-title-md font-bold text-[#173A67]">Chưa có chương trình bình chọn nào</h3>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Ban Chấp hành Công đoàn sẽ sớm công bố các sự kiện bình chọn mới tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Đang mở */}
          {openPolls.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-title-lg font-bold text-[#173A67]">
                  Đang Mở Bình Chọn ({openPolls.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {openPolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Đã kết thúc */}
          {closedPolls.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <MaterialIcon className="text-[22px] text-on-surface-variant" name="history" />
                <h2 className="text-title-lg font-bold text-on-surface-variant">
                  Chương Trình Đã Kết Thúc ({closedPolls.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {closedPolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
