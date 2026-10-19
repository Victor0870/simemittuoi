import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlbumsClient } from "@/components/albums/AlbumsClient";
import { getAlbumMemberContext } from "@/lib/album-access";
import { getAlbums } from "@/lib/data/albums";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Album ảnh | CDILV.VN",
  description: "Album ảnh hoạt động dành riêng cho thành viên Công đoàn CDILV.",
};

export default async function AlbumsPage() {
  const ctx = await getAlbumMemberContext();

  if (!ctx.user) redirect("/login?next=/albums");
  if (!ctx.isApproved) {
    redirect(ctx.approvalStatus === "rejected" ? "/pending?status=rejected" : "/pending");
  }

  const albums = await getAlbums(ctx.supabase, ctx.canManage);

  return <AlbumsClient albums={albums} canManage={ctx.canManage} />;
}
