import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";

const MAX_TITLE = 300;
const MAX_CONTENT = 50000;

export async function POST(request: NextRequest) {
  try {
    const { access, response } = await requirePermission(PERMISSIONS.postsManage);
    if (response) return response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Tiêu đề bài viết không được để trống." }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "Nội dung bài viết không được để trống." }, { status: 400 });
    }
    if (title.length > MAX_TITLE) {
      return NextResponse.json({ error: `Tiêu đề tối đa ${MAX_TITLE} ký tự.` }, { status: 400 });
    }
    if (content.length > MAX_CONTENT) {
      return NextResponse.json({ error: `Nội dung tối đa ${MAX_CONTENT} ký tự.` }, { status: 400 });
    }

    const tag = typeof body.tag === "string" && body.tag.trim() ? body.tag.trim() : "Thông báo";
    const isImportant = body.isImportant === true;

    const { data: post, error } = await createServiceClient()
      .from(CDILV_TABLE.posts)
      .insert({
        title,
        content,
        tag,
        tag_tone: body.tagTone === "error" ? "error" : "primary",
        is_important: isImportant,
        is_active: body.isActive !== false,
        author_id: access.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/posts");

    return NextResponse.json({ success: true, id: post.id, message: "Đã đăng bài viết." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể đăng bài viết.";
    console.error("[api/posts/create] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
