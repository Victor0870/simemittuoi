import type { SupabaseClient } from "@supabase/supabase-js";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type ReactionType = "like" | "heart" | "haha";
export type ReactionCounts = Record<ReactionType, number>;

export const REACTION_TYPES: ReactionType[] = ["like", "heart", "haha"];
export const ALBUM_COMMENT_LIMIT = 3;

export type AlbumSummary = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  allowMemberUpload: boolean;
  maxPhotosPerMember: number;
  uploadPoints: number;
  /** Thời gian thành viên được đăng ảnh (ISO); null = không giới hạn phía đó. */
  uploadStartsAt: string | null;
  uploadEndsAt: string | null;
  isActive: boolean;
  createdAt: string;
  photoCount: number;
};

export type UploadWindowState = "open" | "not_started" | "ended";

export function getUploadWindowState(
  startsAt: string | null,
  endsAt: string | null,
  now: Date = new Date(),
): UploadWindowState {
  if (startsAt && now < new Date(startsAt)) return "not_started";
  if (endsAt && now > new Date(endsAt)) return "ended";
  return "open";
}

export function formatDateTimeVi(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type AlbumPhoto = {
  id: string;
  albumId: string;
  userId: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  timeAgo: string;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string;
  authorDepartment: string | null;
  reactions: ReactionCounts;
  userReaction: ReactionType | null;
  commentCount: number;
};

export type AlbumPhotoComment = {
  id: string;
  photoId: string;
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string;
  authorDepartment: string | null;
  authorCode: string | null;
  content: string;
  createdAt: string;
  timeAgo: string;
  /** Bình luận gốc (null nếu đây là bình luận gốc). */
  parentId: string | null;
  replyToUserId: string | null;
  reactions: ReactionCounts;
  userReaction: ReactionType | null;
};

type AlbumRow = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  allow_member_upload: boolean;
  max_photos_per_member: number;
  upload_points: number;
  upload_starts_at: string | null;
  upload_ends_at: string | null;
  is_active: boolean;
  created_at: string;
};

type ProfileEmbed = {
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  department: string | null;
  employee_code?: string | null;
};

const ALBUM_COLUMNS =
  "id, title, description, cover_url, allow_member_upload, max_photos_per_member, upload_points, upload_starts_at, upload_ends_at, is_active, created_at";

export function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  return `${days} ngày trước`;
}

export function emptyReactions(): ReactionCounts {
  return { like: 0, heart: 0, haha: 0 };
}

export function isReactionType(value: unknown): value is ReactionType {
  return typeof value === "string" && (REACTION_TYPES as string[]).includes(value);
}

function pickProfile(raw: unknown): ProfileEmbed | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as ProfileEmbed | null;
}

function mapAlbum(row: AlbumRow, photoCount: number, fallbackCover: string | null): AlbumSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url || fallbackCover,
    allowMemberUpload: row.allow_member_upload,
    maxPhotosPerMember: row.max_photos_per_member,
    uploadPoints: row.upload_points,
    uploadStartsAt: row.upload_starts_at,
    uploadEndsAt: row.upload_ends_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    photoCount,
  };
}

export function mapPhotoComment(row: {
  id: string;
  photo_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id?: string | null;
  reply_to_user_id?: string | null;
  cdilv_profiles?: unknown;
}): AlbumPhotoComment {
  const prof = pickProfile(row.cdilv_profiles);
  return {
    id: row.id,
    photoId: row.photo_id,
    userId: row.user_id,
    authorName: prof?.full_name || "Đoàn viên",
    authorAvatar: prof?.avatar_url || null,
    authorRole: prof?.role || "user",
    authorDepartment: prof?.department || null,
    authorCode: prof?.employee_code || null,
    content: row.content,
    createdAt: row.created_at,
    timeAgo: formatTimeAgo(row.created_at),
    parentId: row.parent_id ?? null,
    replyToUserId: row.reply_to_user_id ?? null,
    reactions: emptyReactions(),
    userReaction: null,
  };
}

export async function getAlbums(
  supabase: SupabaseClient,
  includeInactive: boolean,
): Promise<AlbumSummary[]> {
  let query = supabase
    .from(CDILV_TABLE.albums)
    .select(ALBUM_COLUMNS)
    .order("created_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data: albums, error } = await query;
  if (error) throw error;
  if (!albums || albums.length === 0) return [];

  const { data: photos, error: photoErr } = await supabase
    .from(CDILV_TABLE.albumPhotos)
    .select("album_id, image_url")
    .in(
      "album_id",
      albums.map((a) => a.id),
    )
    .order("created_at", { ascending: false });
  if (photoErr) throw photoErr;

  const counts = new Map<string, number>();
  const latest = new Map<string, string>();
  for (const p of photos ?? []) {
    counts.set(p.album_id, (counts.get(p.album_id) ?? 0) + 1);
    if (!latest.has(p.album_id)) latest.set(p.album_id, p.image_url);
  }

  return (albums as AlbumRow[]).map((row) =>
    mapAlbum(row, counts.get(row.id) ?? 0, latest.get(row.id) ?? null),
  );
}

export async function getAlbumDetail(
  supabase: SupabaseClient,
  albumId: string,
  viewerId: string,
): Promise<{ album: AlbumSummary; photos: AlbumPhoto[] } | null> {
  const { data: albumRow, error } = await supabase
    .from(CDILV_TABLE.albums)
    .select(ALBUM_COLUMNS)
    .eq("id", albumId)
    .maybeSingle();
  if (error) throw error;
  if (!albumRow) return null;

  const [photosRes, reactionsRes, commentsRes] = await Promise.all([
    supabase
      .from(CDILV_TABLE.albumPhotos)
      .select(
        "id, album_id, user_id, image_url, caption, created_at, cdilv_profiles ( full_name, avatar_url, role, department )",
      )
      .eq("album_id", albumId)
      .order("created_at", { ascending: false }),
    supabase
      .from(CDILV_TABLE.albumPhotoReactions)
      .select("photo_id, user_id, reaction_type, cdilv_album_photos!inner ( album_id )")
      .eq("cdilv_album_photos.album_id", albumId),
    supabase
      .from(CDILV_TABLE.albumPhotoComments)
      .select("photo_id, cdilv_album_photos!inner ( album_id )")
      .eq("cdilv_album_photos.album_id", albumId),
  ]);

  if (photosRes.error) throw photosRes.error;
  if (reactionsRes.error) throw reactionsRes.error;
  if (commentsRes.error) throw commentsRes.error;

  const reactionMap = new Map<string, { counts: ReactionCounts; mine: ReactionType | null }>();
  for (const r of reactionsRes.data ?? []) {
    if (!isReactionType(r.reaction_type)) continue;
    const entry = reactionMap.get(r.photo_id) ?? { counts: emptyReactions(), mine: null };
    entry.counts[r.reaction_type]++;
    if (r.user_id === viewerId) entry.mine = r.reaction_type;
    reactionMap.set(r.photo_id, entry);
  }

  const commentCounts = new Map<string, number>();
  for (const c of commentsRes.data ?? []) {
    commentCounts.set(c.photo_id, (commentCounts.get(c.photo_id) ?? 0) + 1);
  }

  const photos: AlbumPhoto[] = (photosRes.data ?? []).map((row) => {
    const prof = pickProfile(row.cdilv_profiles);
    const reaction = reactionMap.get(row.id);
    return {
      id: row.id,
      albumId: row.album_id,
      userId: row.user_id,
      imageUrl: row.image_url,
      caption: row.caption,
      createdAt: row.created_at,
      timeAgo: formatTimeAgo(row.created_at),
      authorName: prof?.full_name || "Đoàn viên",
      authorAvatar: prof?.avatar_url || null,
      authorRole: prof?.role || "user",
      authorDepartment: prof?.department || null,
      reactions: reaction?.counts ?? emptyReactions(),
      userReaction: reaction?.mine ?? null,
      commentCount: commentCounts.get(row.id) ?? 0,
    };
  });

  return {
    album: mapAlbum(albumRow as AlbumRow, photos.length, photos[0]?.imageUrl ?? null),
    photos,
  };
}
