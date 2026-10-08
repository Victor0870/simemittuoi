/**
 * Thương hiệu CDILV — nguồn duy nhất cho tên hiển thị và tên miền.
 * Production: https://cdilv.vn — gắn Custom Domain trên Vercel + DNS +
 * cập nhật NEXT_PUBLIC_SITE_URL / Supabase Auth redirect URLs cho khớp siteUrl.
 */
export const BRAND = {
  name: "CDILV",
  domain: "cdilv.vn",
  /** URL canonical; runtime override bằng NEXT_PUBLIC_SITE_URL */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://cdilv.vn",
  tagline: "Nâng tầm sức mạnh tập thể",
  productLine: "Trung tâm gắn kết đoàn viên",
  description:
    "Website công đoàn báo cáo hoạt động, quản lý điểm và bảng xếp hạng đoàn viên.",
} as const;

/** Tiêu đề tab trình duyệt / metadata — chỉ thương hiệu CDILV */
export const BRAND_TITLE = BRAND.name;

export const BRAND_COPYRIGHT = `© ${new Date().getFullYear()} ${BRAND.name}. ${BRAND.tagline}.`;
