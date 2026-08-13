import { MaterialIcon } from "@/components/ui/MaterialIcon";

type MyRankSummaryProps = {
  rank: number;
  score: number;
};

export function MyRankSummary({ rank, score }: MyRankSummaryProps) {
  return (
    <section className="tonal-elevation-1 mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-container">
          <MaterialIcon
            className="text-2xl text-on-tertiary-container"
            filled
            name="military_tech"
          />
        </div>
        <div>
          <p className="text-sm text-on-surface-variant">Hạng của bạn</p>
          <p className="text-2xl font-extrabold text-primary">#{rank}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm text-on-surface-variant">Tổng điểm</p>
        <p className="text-2xl font-extrabold text-[#173A67]">
          {score.toLocaleString("vi-VN")}
        </p>
      </div>
    </section>
  );
}
