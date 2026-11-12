import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@gpis-academy/shared"],
  // Lessons are read from content/ at the repository root when a page is served.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: { "/**": ["../../content/**/*"] },
  turbopack: { root: repoRoot },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
