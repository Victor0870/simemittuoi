import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CDILV_RPC, CDILV_TABLE } from "@/lib/supabase/tables";

export type AlbumMemberContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
  fullName: string | null;
  approvalStatus: string | null;
  isApproved: boolean;
  isAdmin: boolean;
  /** Admin hoặc cấp được phân quyền albums.manage. */
  canManage: boolean;
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
      canManage: false,
    };
  }

  // Quyền albums.manage chỉ được dùng khi đã duyệt và không phải admin; truy vấn song song với hồ sơ (chỉ đọc)
  const [{ data: me, error }, { data: allowed, error: permError }] = await Promise.all([
    supabase
      .from(CDILV_TABLE.profiles)
      .select("role, full_name, approval_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc(CDILV_RPC.hasPermission, {
      p_code: PERMISSIONS.albumsManage,
    }),
  ]);

  if (error) throw error;

  const isApproved = me?.approval_status === "approved";
  const isAdmin = isApproved && me?.role === "admin";
  let canManage = isAdmin;
  if (isApproved && !isAdmin) {
    if (permError) console.error("[album-access] has_permission:", permError.message);
    canManage = allowed === true;
  }
  return {
    supabase,
    user,
    fullName: me?.full_name ?? null,
    approvalStatus: me?.approval_status ?? null,
    isApproved,
    isAdmin,
    canManage,
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

  const parseTime = (value: unknown): string | null | undefined => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string") return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  const uploadStartsAt = allowMemberUpload ? parseTime(body.uploadStartsAt) : null;
  const uploadEndsAt = allowMemberUpload ? parseTime(body.uploadEndsAt) : null;
  if (uploadStartsAt === undefined || uploadEndsAt === undefined) {
    return { error: "Thời gian đăng ảnh không hợp lệ." } as const;
  }
  if (uploadStartsAt && uploadEndsAt && uploadEndsAt <= uploadStartsAt) {
    return { error: "Thời gian kết thúc đăng ảnh phải sau thời gian bắt đầu." } as const;
  }

  return {
    values: {
      title,
      description: description || null,
      allow_member_upload: allowMemberUpload,
      max_photos_per_member: maxPhotosPerMember,
      upload_points: allowMemberUpload ? uploadPoints : 0,
      upload_starts_at: uploadStartsAt,
      upload_ends_at: uploadEndsAt,
      is_active: isActive,
    },
  } as const;
}
