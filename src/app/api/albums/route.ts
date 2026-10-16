import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAlbumMemberContext, parseAlbumSettings } from "@/lib/album-access";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_STORAGE, CDILV_TABLE } from "@/lib/supabase/tables";

async function requireAdmin() {
  const ctx = await getAlbumMemberContext();
  if (!ctx.user) {
    return { response: NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  }
  if (!ctx.isAdmin) {
    return {
      response: NextResponse.json(
        { error: "Chỉ Quản trị viên mới được quản lý album." },
        { status: 403 },
      ),
    };
  }
  return { ctx };
}

export async function POST(request: NextRequest) {
  try {
    const { ctx, response } = await requireAdmin();
    if (response) return response;

    const parsed = parseAlbumSettings(await request.json());
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const writer = createServiceClient();
    const { data, error } = await writer
      .from(CDILV_TABLE.albums)
      .insert({ ...parsed.values, created_by: ctx.user!.id })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/albums");
    return NextResponse.json({ success: true, id: data.id, message: "Đã tạo album mới." });
  } catch (err: any) {
    console.error("[api/albums] POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể tạo album." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã album." }, { status: 400 });
    }

    const writer = createServiceClient();
    let updates: Record<string, unknown>;

    if (body.coverOnly === true) {
      updates = { cover_url: typeof body.coverUrl === "string" ? body.coverUrl : null };
    } else {
      const parsed = parseAlbumSettings(body);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      updates = parsed.values;
    }

    const { error } = await writer
      .from(CDILV_TABLE.albums)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/albums");
    revalidatePath(`/albums/${id}`);
    return NextResponse.json({ success: true, message: "Đã cập nhật album." });
  } catch (err: any) {
    console.error("[api/albums] PATCH error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể cập nhật album." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã album." }, { status: 400 });
    }

    const writer = createServiceClient();
    const { data: photos, error: photoErr } = await writer
      .from(CDILV_TABLE.albumPhotos)
      .select("storage_path")
      .eq("album_id", id);
    if (photoErr) throw photoErr;

    const { error } = await writer.from(CDILV_TABLE.albums).delete().eq("id", id);
    if (error) throw error;

    const paths = (photos ?? [])
      .map((p) => p.storage_path)
      .filter((p): p is string => Boolean(p));
    for (let i = 0; i < paths.length; i += 100) {
      const { error: rmErr } = await writer.storage
        .from(CDILV_STORAGE.albums)
        .remove(paths.slice(i, i + 100));
      if (rmErr) console.error("[api/albums] storage remove error:", rmErr.message);
    }

    revalidatePath("/albums");
    revalidatePath("/leaderboard");
    revalidatePath("/");
    return NextResponse.json({ success: true, message: "Đã xóa album." });
  } catch (err: any) {
    console.error("[api/albums] DELETE error:", err);
    return NextResponse.json(
      { error: err?.message || "Không thể xóa album." },
      { status: 500 },
    );
  }
}
