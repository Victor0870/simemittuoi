import { notFound, redirect } from "next/navigation";
import { ContestSubmissionsManager } from "@/components/admin/ContestSubmissionsManager";
import { getCurrentAccess } from "@/lib/auth/guard";
import { getPostById } from "@/lib/data/posts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ContestSubmissionsPage({ params }: Props) {
  const { id } = await params;
  const access = await getCurrentAccess();
  if (!access) redirect(`/login?next=/admin/content/posts/submissions/${encodeURIComponent(id)}`);
  if (!access.isAdmin) redirect("/");

  const post = await getPostById(id);
  if (!post || !post.isContest) notFound();

  return <ContestSubmissionsManager postId={post.id} postTitle={post.title} />;
}
