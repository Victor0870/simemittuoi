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
    <section className="tonal-elevation-1 rounded-3xl bg-primary p-6 text-on-primary">
      <div className="mb-4 flex items-center gap-3">
        <MaterialIcon className="text-primary-fixed" name="trending_up" />
        <h4 className="font-bold">Mục tiêu Đoàn viên</h4>
      </div>

      <div className="mb-2 flex justify-between text-sm">
        <span className="text-on-primary/90">{title}</span>
        <span className="font-bold">{progress}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full bg-white"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-4 text-xs italic opacity-80">{note}</p>
    </section>
  );
}
