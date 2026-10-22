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
};

export default nextConfig;
