import { createServiceClient } from "@/lib/supabase/service";
import { CDILV_TABLE } from "@/lib/supabase/tables";
import type { RegulationDocument, RegulationSection, RegulationWithSections } from "./types";

export async function getRegulationDocumentWithSections(
  year = 2026,
): Promise<RegulationWithSections | null> {
  const supabase = createServiceClient();

  const { data: doc, error: docError } = await supabase
    .from(CDILV_TABLE.regulationDocuments)
    .select("*")
    .eq("year", year)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (docError) {
    console.error("[regulations/server] error loading document:", docError.message);
    return null;
  }
  if (!doc) return null;

  const { data: sections, error: secError } = await supabase
    .from(CDILV_TABLE.regulationSections)
    .select("*")
    .eq("document_id", doc.id)
    .order("order_index", { ascending: true });

  if (secError) {
    console.error("[regulations/server] error loading sections:", secError.message);
    return {
      ...(doc as RegulationDocument),
      sections: [],
    };
  }

  return {
    ...(doc as RegulationDocument),
    sections: (sections ?? []) as RegulationSection[],
  };
}

export async function updateRegulationSection(
  sectionId: string,
  data: { heading: string; body_text: string },
  userId: string,
): Promise<RegulationSection> {
  const supabase = createServiceClient();

  const { data: updated, error } = await supabase
    .from(CDILV_TABLE.regulationSections)
    .update({
      heading: data.heading.trim(),
      body_text: data.body_text,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sectionId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Không thể cập nhật điều khoản.");
  }

  return updated as RegulationSection;
}

export async function extractSectionToPost(
  sectionId: string,
  userId: string,
): Promise<{ postId: string; title: string }> {
  const supabase = createServiceClient();

  // 1. Get section and document
  const { data: section, error: secError } = await supabase
    .from(CDILV_TABLE.regulationSections)
    .select("*")
    .eq("id", sectionId)
    .single();

  if (secError || !section) {
    throw new Error("Không tìm thấy điều khoản quy chế cần trích.");
  }

  const { data: doc, error: docError } = await supabase
    .from(CDILV_TABLE.regulationDocuments)
    .select("title")
    .eq("id", section.document_id)
    .single();

  const docTitle = doc?.title || "Quy chế chi tiêu tài chính 2026";
  const sourceLine = `Nguồn: ${docTitle} - ${section.article_number || "Quy chế"}`;

  const postTitle = section.heading.trim();
  const postContent = `${section.body_text.trim()}\n\n---\n*${sourceLine}*`;

  // 2. Insert into cdilv_posts as an UNPUBLISHED DRAFT (is_active = false)
  const { data: post, error: postError } = await supabase
    .from(CDILV_TABLE.posts)
    .insert({
      title: postTitle,
      content: postContent,
      tag: "Quy chế",
      tag_tone: "primary",
      is_active: false, // Bắt buộc là bản nháp chưa công bố, tuyệt đối không tự xuất bản
      is_important: false,
      is_contest: false,
      author_id: userId,
    })
    .select("id, title")
    .single();

  if (postError || !post) {
    throw new Error(postError?.message || "Không thể tạo bản nháp bài viết từ điều khoản quy chế.");
  }

  return {
    postId: post.id,
    title: post.title,
  };
}
