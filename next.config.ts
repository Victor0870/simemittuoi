import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mẫu Excel đọc bằng fs khi in phiếu (src/lib/print/xlsx-template.ts)
  outputFileTracingIncludes: {
    "/api/visits/[id]/print": ["./src/lib/print/templates/**/*"],
    "/api/payments/[id]/print": ["./src/lib/print/templates/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // BizMate shared project (CDILV)
        protocol: "https",
        hostname: "pzcwwylxrojvcoihtxep.supabase.co",
      },
    ],
  },
  // Khu vực /office cũ đã gộp vào khung /admin; giữ link cũ (bookmark, thông báo đã gửi) còn dùng được
  async redirects() {
    return [
      { source: "/office", destination: "/admin", permanent: true },
      { source: "/office/members/:path*", destination: "/admin/members/:path*", permanent: true },
      { source: "/office/life-events/:path*", destination: "/admin/administration/life-events/:path*", permanent: true },
      { source: "/office/visits/:path*", destination: "/admin/administration/visits/:path*", permanent: true },
      { source: "/office/payments/:path*", destination: "/admin/administration/payments/:path*", permanent: true },
      { source: "/office/rewards/:path*", destination: "/admin/administration/rewards/:path*", permanent: true },
      { source: "/office/gifts/:path*", destination: "/admin/administration/gifts/:path*", permanent: true },
      { source: "/office/print-settings/:path*", destination: "/admin/administration/print-settings/:path*", permanent: true },
      { source: "/office/finance/settings/:path*", destination: "/admin/finance/settings/:path*", permanent: true },
      { source: "/office/finance/:path*", destination: "/admin/finance/ledger/:path*", permanent: true },
      { source: "/office/reports/:path*", destination: "/admin/finance/reports/:path*", permanent: true },
      { source: "/office/catalogs/:path*", destination: "/admin/finance/catalogs/:path*", permanent: true },
      { source: "/office/:path*", destination: "/admin", permanent: true },
    ];
  },
};

export default nextConfig;
