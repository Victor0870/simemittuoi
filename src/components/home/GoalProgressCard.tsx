import { MaterialIcon } from "@/components/ui/MaterialIcon";

type GoalProgressCardProps = {
  title: string;
  progress: number;
  note: string;
};

export function GoalProgressCard({
  title,
  progress,
  note,
}: GoalProgressCardProps) {
  return (
    <section
      className="rounded-3xl border border-[#A8DDD1]/40 p-6 shadow-[0_1px_3px_rgba(23,58,103,0.06)]"
      style={{ backgroundColor: "#D9F2EC" }}
    >
      <div className="mb-4 flex items-center gap-3">
        <MaterialIcon className="text-[#173A67]" name="trending_up" />
        <h4 className="font-bold text-[#173A67]">Mục tiêu Đoàn viên</h4>
      </div>

      <div className="mb-2 flex justify-between text-sm">
        <span className="text-[#27496D]">{title}</span>
        <span className="font-bold text-[#173A67]">{progress}%</span>
      </div>

      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "#A8DDD1" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            backgroundImage:
              "linear-gradient(90deg, #2563EB 0%, #1D9BF0 50%, #14B8A6 100%)",
          }}
        />
      </div>

      <p className="mt-4 text-xs italic text-[#27496D]/85">{note}</p>
    </section>
  );
}
