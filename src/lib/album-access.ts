import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type AlbumMemberContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
  fullName: string | null;
  approvalStatus: string | null;
  isApproved: boolean;
  isAdmin: boolean;
};

/**
 * Hồ sơ đọc bằng phiên đăng nhập của người dùng (không dùng service role)
 * để quyết định quyền xem / đăng ảnh trong Album.
 */
export async function getAlbumMemberContext(): Promise<AlbumMemberContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      fullName: null,
      approvalStatus: null,
      isApproved: false,
      isAdmin: false,
    };
  }

  const { data: me, error } = await supabase
    .from(CDILV_TABLE.profiles)
    .select("role, full_name, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  const isApproved = me?.approval_status === "approved";
  return {
    supabase,
    user,
    fullName: me?.full_name ?? null,
    approvalStatus: me?.approval_status ?? null,
    isApproved,
    isAdmin: isApproved && me?.role === "admin",
  };
}

export function parseAlbumSettings(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const allowMemberUpload = body.allowMemberUpload === true;
  const maxPhotosPerMember = Number(body.maxPhotosPerMember);
  const uploadPoints = Number(body.uploadPoints);
  const isActive = body.isActive !== false;

  if (!title) return { error: "Vui lòng nhập tên album." } as const;
  if (title.length > 120) return { error: "Tên album tối đa 120 ký tự." } as const;
  if (description.length > 1000) {
    return { error: "Mô tả album tối đa 1000 ký tự." } as const;
  }
  if (!Number.isInteger(maxPhotosPerMember) || maxPhotosPerMember < 1 || maxPhotosPerMember > 100) {
    return { error: "Giới hạn ảnh mỗi thành viên phải từ 1 đến 100." } as const;
  }
  if (!Number.isInteger(uploadPoints) || uploadPoints < 0 || uploadPoints > 100) {
    return { error: "Điểm thưởng mỗi ảnh phải từ 0 đến 100." } as const;
  }

  return {
    values: {
      title,
      description: description || null,
      allow_member_upload: allowMemberUpload,
      max_photos_per_member: maxPhotosPerMember,
      upload_points: allowMemberUpload ? uploadPoints : 0,
      is_active: isActive,
    },
  } as const;
}
