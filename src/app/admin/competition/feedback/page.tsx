import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FeedbackClient } from "@/components/feedback/FeedbackClient";
import { getCurrentAccess } from "@/lib/auth/guard";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Quản lý góp ý | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function AdminFeedbackPage() {
  const access = await getCurrentAccess();
  if (!access) redirect("/login?next=/admin/competition/feedback");
  if (!access.isAdmin) redirect("/");

  return <FeedbackClient mode="admin" />;
}
