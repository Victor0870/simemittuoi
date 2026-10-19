export { BRAND, BRAND_TITLE, BRAND_COPYRIGHT } from "@/lib/brand";

export const LOGO_URL =
  "https://lh3.googleusercontent.com/aida/AP1WRLtcdh_jX3PUwkcmg3KywgQi-bUt3RuOKJay8F7aERPrQrImDZM7Cs9U23a2NrNOvpg396nKazeBhsgW3dk3RP3Lfb9eTuNGUgdQKcgEfGqTCfvVW8c-hzh1kQBpieeWxK-kXohCN9svVlmEISRp4y8HeJAXXoZarqdGqHnVfTrShyPCagrfoSOdmZFQ49y3CHbKG6tsTgdOflfj8CNSv5hgleSgtC50XQpr5GwORDk7go8f6cmplcaX-nk";

export const USER_AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCEaiLRt-cAPMpsPxxe4CCjbdrPG0C-is3c0monqBvEdm4UsWU_h_9ySDm4yWKsmmlA6KA570SO3Ngrj_IhbCJ6IqJmM_2h4_GX0K_Youq-AWxDJOjCG3ih9XhRSXBq8s5N4MGnKscoSC9oDWbMYZRbQ3URwMhKrB6MSjRg5Ig1JCCVY6x3CIFwWpQqi7lIvv3tFamspSVryR1tZFlJttMN_fAyl1sXqlVDvv56QQKKzDkdVLbKPvsqCVD82nTZTp8SRnKVCYv1Vo4";

export const NAV_ITEMS = [
  { href: "/", label: "Trang chủ", icon: "home" },
  { href: "/posts", label: "Bài viết", icon: "article" },
  { href: "/polls", label: "Bình chọn", icon: "how_to_vote" },
  { href: "/leaderboard", label: "Bảng xếp hạng", icon: "leaderboard" },
  { href: "/feedback", label: "Góp ý", icon: "rate_review" },
  { href: "/missions", label: "Nhiệm vụ", icon: "task_alt" },
] as const;

/** Chỉ hiển thị cho thành viên đã được phê duyệt. */
export const MEMBER_NAV_ITEMS = [
  { href: "/life-events", label: "Báo tin", shortLabel: "Báo tin", icon: "campaign" },
  { href: "/albums", label: "Album ảnh", shortLabel: "Album", icon: "photo_library" },
  { href: "/quiz", label: "Trắc nghiệm", shortLabel: "Trắc nghiệm", icon: "quiz" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Trang chủ", icon: "home" },
  { href: "/posts", label: "Bài viết", icon: "article" },
  { href: "/polls", label: "Bình chọn", icon: "how_to_vote" },
  { href: "/leaderboard", label: "Xếp hạng", icon: "leaderboard" },
  { href: "/feedback", label: "Góp ý", icon: "rate_review" },
] as const;
