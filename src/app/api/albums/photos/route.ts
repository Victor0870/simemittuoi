import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAlbumMemberContext } from "@/lib/album-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_RPC, CDILV_STORAGE, CDILV_TABLE } from "@/lib/supabase/tables";
import { sanitizeCompanyNames } from "@/lib/privacy";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAlbumMemberContext();
    if (!ctx.user) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }
    if (!ctx.isApproved) {
      return NextResponse.json(
        { error: "Chỉ thành viên đã được phê duyệt mới được đăng ảnh." },
        { status: 403 },
      );
    }

    const form = await request.formData();
    const albumId = String(form.get("albumId") || "");
    const caption = String(form.get("caption") || "").trim();
    const file = form.get("file");

    if (!albumId) {
      return NextResponse.json({ error: "Thiếu mã album." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Vui lòng chọn ảnh để đăng." }, { status: 400 });
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Dung lượng ảnh tối đa là 5MB." }, { status: 400 });
    }
    if (caption.length > 500) {
      return NextResponse.json({ error: "Chú thích ảnh tối đa 500 ký tự." }, { status: 400 });
    }

    const writer = createServiceClient();
    const { data: album, error: albumErr } = await writer
      .from(CDILV_TABLE.albums)
      .select("id, is_active, allow_member_upload, max_photos_per_member, upload_points")
      .eq("id", albumId)
      .maybeSingle();

    if (albumErr) throw albumErr;
    if (!album || (!album.is_active && !ctx.isAdmin)) {
      return NextResponse.json({ error: "Album không tồn tại." }, { status: 404 });
    }

    const userId = ctx.user.id;

    if (!ctx.isAdmin) {
      if (!album.allow_member_upload) {
        return NextResponse.json(
          { error: "Album này chỉ Quản trị viên được đăng ảnh." },
          { status: 403 },
        );
      }

      const { count, error: countErr } = await writer
        .from(CDILV_TABLE.albumPhotos)
        .select("id", { count: "exact", head: true })
        .eq("album_id", albumId)
        .eq("user_id", userId);
      if (countErr) throw countErr;

      if ((count ?? 0) >= album.max_photos_per_member) {
        return NextResponse.json(
          {
            error: `Bạn đã đăng tối đa ${album.max_photos_per_member} ảnh cho album này.`,
            limitReached: true,
          },
          { status: 400 },
        );
      }
    }

    const storagePath = `${albumId}/${userId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error: uploadErr } = await writer.storage
      .from(CDILV_STORAGE.albums)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadErr) throw uploadErr;

    const { data: pub } = writer.storage.from(CDILV_STORAGE.albums).getPublicUrl(storagePath);

    const { data: photo, error: insertErr } = await writer
      .from(CDILV_TABLE.albumPhotos)
      .insert({
        album_id: albumId,
        user_id: userId,
        image_url: pub.publicUrl,
        storage_path: storagePath,
        caption: caption ? sanitizeCompanyNames(caption) : null,
      })
      .select("id, album_id, user_id, image_url, caption, created_at")
      .single();

    if (insertErr) {
      await writer.storage.from(CDILV_STORAGE.albums).remove([storagePath]);
      throw insertErr;
    }

    let pointsAwarded = 0;
    const { data: awarded, error: rpcErr } = await writer.rpc(CDILV_RPC.awardAlbumPhotoScore, {
      p_photo_id: photo.id,
    });
    if (rpcErr) {
      console.error("[api/albums/photos] score award RPC error:", rpcErr.message);
    } else {
      pointsAwarded = Number(awarded) || 0;
    }

    revalidatePath(`/albums/${albumId}`);
    revalidatePath("/albums");
    if (pointsAwarded > 0) {
      revalidatePath("/leaderboard");
      revalidatePath("/");
    }

    return NextResponse.json({
      success: true,
      photo,
      pointsAwarded,
      message:
        pointsAwarded > 0
          ? `Đăng ảnh thành công! Bạn nhận được +${pointsAwarded} điểm thi đua.`
          : "Đăng ảnh thành công!",
    });
  } catch (err: any) {
    console.error("[api/albums/photos] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể đăng ảnh." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAlbumMemberContext();
    if (!ctx.user || !ctx.isApproved) {
      return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã ảnh." }, { status: 400 });
    }

    const writer = createServiceClient();
    const { data: photo, error: fetchErr } = await writer
      .from(CDILV_TABLE.albumPhotos)
      .select("id, album_id, user_id, image_url, storage_path")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!photo) {
      return NextResponse.json({ error: "Ảnh không tồn tại hoặc đã bị xóa." }, { status: 404 });
    }
    if (!ctx.isAdmin && photo.user_id !== ctx.user.id) {
      return NextResponse.json({ error: "Bạn không có quyền xóa ảnh này." }, { status: 403 });
    }

    const { error: delErr } = await writer.from(CDILV_TABLE.albumPhotos).delete().eq("id", id);
    if (delErr) throw delErr;

    await writer
      .from(CDILV_TABLE.albums)
      .update({ cover_url: null })
      .eq("id", photo.album_id)
      .eq("cover_url", photo.image_url);

    if (photo.storage_path) {
      const { error: rmErr } = await writer.storage
        .from(CDILV_STORAGE.albums)
        .remove([photo.storage_path]);
      if (rmErr) console.error("[api/albums/photos] storage remove error:", rmErr.message);
    }

    revalidatePath(`/albums/${photo.album_id}`);
    revalidatePath("/albums");
    revalidatePath("/leaderboard");
    revalidatePath("/");

    return NextResponse.json({
      success: true,
      message: "Đã xóa ảnh. Điểm thi đua liên quan (nếu có) đã được thu hồi.",
    });
  } catch (err: any) {
    console.error("[api/albums/photos] DELETE error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể xóa ảnh." },
      { status: 500 },
    );
  }
}
