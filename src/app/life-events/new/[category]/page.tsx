import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LifeEventForm } from "@/components/life-events/LifeEventForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { getCurrentAccess } from "@/lib/auth/guard";
import { isMemberSubmittableCategory, todayInVietnam } from "@/lib/life-events/registry";

type PageProps = { params: Promise<{ category: string }> };

export default async function NewLifeEventPage({ params }: PageProps) {
  const { category } = await params;
  if (!isMemberSubmittableCategory(category)) notFound();

  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/life-events/new/${category}`);
  if (!access.isApproved) redirect("/pending");

  return (
    <div className="max-w-2xl space-y-4 pb-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-[#173A67]"
        href="/life-events"
      >
        <MaterialIcon className="text-[18px]" name="arrow_back" />
        Báo tin
      </Link>
      <LifeEventForm category={category} today={todayInVietnam()} />
    </div>
  );
}
