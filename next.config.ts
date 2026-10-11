import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
