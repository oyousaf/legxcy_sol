import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/outreach/:path*", "/api/:path*"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
    }));
  },
};

export default nextConfig;
