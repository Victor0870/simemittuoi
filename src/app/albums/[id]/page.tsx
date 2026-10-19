import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AlbumDetailClient } from "@/components/albums/AlbumDetailClient";
import { getAlbumMemberContext } from "@/lib/album-access";
import { getAlbumDetail } from "@/lib/data/albums";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Album ảnh | CDILV.VN",
};

type AlbumDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photo?: string }>;
};

export default async function AlbumDetailPage({ params, searchParams }: AlbumDetailPageProps) {
  const { id } = await params;
  const { photo } = await searchParams;
  const ctx = await getAlbumMemberContext();

  if (!ctx.user) redirect(`/login?next=/albums/${id}`);
  if (!ctx.isApproved) {
    redirect(ctx.approvalStatus === "rejected" ? "/pending?status=rejected" : "/pending");
  }

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const detail = await getAlbumDetail(ctx.supabase, id, ctx.user.id);
  if (!detail || (!detail.album.isActive && !ctx.canManage)) notFound();

  return (
    <AlbumDetailClient
      album={detail.album}
      initialPhotos={detail.photos}
      initialPhotoId={photo ?? null}
      canManage={ctx.canManage}
      currentUserId={ctx.user.id}
    />
  );
}
