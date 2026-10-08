import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "qpaoucyjitbmfcahxrqu.supabase.co",
      },
      {
        // BizMate shared project (khi gộp CDILV)
        protocol: "https",
        hostname: "pzcwwylxrojvcoihtxep.supabase.co",
      },
    ],
  },
};

export default nextConfig;
