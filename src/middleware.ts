import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Bỏ qua: toàn bộ /_next (static, image, data, HMR), file tĩnh theo đuôi, favicon/robots/sitemap/manifest,
// và route handler /api, /auth (tự làm mới phiên qua createClient; không có chuyển hướng nào của middleware áp dụng cho chúng).
export const config = {
  matcher: [
    "/((?!_next/|api/|auth/|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|bmp|ico|css|js|mjs|map|json|webmanifest|woff2?|ttf|otf|eot|txt|xml|pdf|mp4|webm|mp3|wav)$).*)",
  ],
};
