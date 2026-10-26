import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminAlbumsManager } from "@/components/admin/AdminAlbumsManager";
import { getAlbumMemberContext } from "@/lib/album-access";
import { BRAND } from "@/lib/brand";
import { getAlbums } from "@/lib/data/albums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Quản lý album ảnh | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default async function AdminAlbumsPage() {
  const ctx = await getAlbumMemberContext();
  if (!ctx.user) redirect("/login?next=/admin/content/albums");
  if (!ctx.canManage) redirect("/");

  const albums = await getAlbums(ctx.supabase, true);

  return <AdminAlbumsManager albums={albums} />;
}
