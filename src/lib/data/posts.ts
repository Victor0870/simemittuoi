import { createPublicClient } from "@/lib/supabase/public";
import { CDILV_TABLE } from "@/lib/supabase/tables";

export type PostSummary = {
  id: string;
  title: string;
  excerpt: string;
  tag: string;
  tagTone: "primary" | "error";
  isImportant: boolean;
  imageUrl: string | null;
  publishedAt: string;
  timeAgo: string;
};

export type PostDetail = PostSummary & {
  content: string;
};

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Vừa xong";
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  return `${days} ngày trước`;
}

function excerptFrom(content: string, max = 160): string {
  const plain = content.replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trim()}…`;
}

function mapRow(row: {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  tag_tone: string | null;
  is_important?: boolean | null;
  image_url: string | null;
  published_at: string;
}): PostDetail {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    excerpt: excerptFrom(row.content),
    tag: row.tag ?? "Thông báo",
    tagTone: row.tag_tone === "error" ? "error" : "primary",
    isImportant: Boolean(row.is_important),
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    timeAgo: formatTimeAgo(row.published_at),
  };
}

export async function getPosts(limit = 50): Promise<PostSummary[]> {
  const db = createPublicClient();
  const { data, error } = await db
    .from(CDILV_TABLE.posts)
    .select("id, title, content, tag, tag_tone, is_important, image_url, published_at")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[posts] list:", error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

export async function getPostById(id: string): Promise<PostDetail | null> {
  const db = createPublicClient();
  const { data, error } = await db
    .from(CDILV_TABLE.posts)
    .select("id, title, content, tag, tag_tone, is_important, image_url, published_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[posts] detail:", error.message);
    return null;
  }
  if (!data) return null;
  return mapRow(data);
}

export async function getRelatedPosts(
  excludeId: string,
  limit = 3,
): Promise<PostSummary[]> {
  const db = createPublicClient();
  const { data, error } = await db
    .from(CDILV_TABLE.posts)
    .select("id, title, content, tag, tag_tone, is_important, image_url, published_at")
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[posts] related:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export type CommentReactions = {
  like: number;
  heart: number;
  haha: number;
};

export type PostComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string;
  authorDepartment: string | null;
  authorCode: string | null;
  content: string;
  createdAt: string;
  timeAgo: string;
  reactions?: CommentReactions;
  userReaction?: "like" | "heart" | "haha" | null;
};

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const db = createPublicClient();
  const { data, error } = await db
    .from(CDILV_TABLE.postComments)
    .select(`
      id,
      post_id,
      user_id,
      content,
      created_at,
      cdilv_profiles (
        id,
        full_name,
        avatar_url,
        role,
        department,
        employee_code
      )
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[posts] getPostComments error:", error.message);
    return [];
  }

  const commentIds = (data ?? []).map((row: any) => row.id);
  const reactionsMap = new Map<string, CommentReactions>();

  if (commentIds.length > 0) {
    const { data: rawReactions } = await db
      .from(CDILV_TABLE.commentReactions)
      .select("comment_id, reaction_type")
      .in("comment_id", commentIds);

    for (const r of rawReactions ?? []) {
      if (!reactionsMap.has(r.comment_id)) {
        reactionsMap.set(r.comment_id, { like: 0, heart: 0, haha: 0 });
      }
      const curr = reactionsMap.get(r.comment_id)!;
      if (r.reaction_type === "like") curr.like++;
      else if (r.reaction_type === "heart") curr.heart++;
      else if (r.reaction_type === "haha") curr.haha++;
    }
  }

  return (data ?? []).map((row: any) => {
    const prof = Array.isArray(row.cdilv_profiles)
      ? row.cdilv_profiles[0]
      : row.cdilv_profiles;
    return {
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      authorName: prof?.full_name || "Đoàn viên",
      authorAvatar: prof?.avatar_url || null,
      authorRole: prof?.role || "user",
      authorDepartment: prof?.department || null,
      authorCode: prof?.employee_code || null,
      content: row.content,
      createdAt: row.created_at,
      timeAgo: formatTimeAgo(row.created_at),
      reactions: reactionsMap.get(row.id) || { like: 0, heart: 0, haha: 0 },
    };
  });
}

export async function getPostCommentsCount(postId: string): Promise<number> {
  const db = createPublicClient();
  const { count, error } = await db
    .from(CDILV_TABLE.postComments)
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) {
    console.error("[posts] getPostCommentsCount error:", error.message);
    return 0;
  }

  return count ?? 0;
}


