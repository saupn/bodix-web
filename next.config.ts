import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  compress: true,
  devIndicators: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // ── Source map upload (requires SENTRY_AUTH_TOKEN in CI/Vercel env) ──────
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "bodix-web",

  // Suppress Sentry CLI output in local dev; show in CI
  silent: !process.env.CI,

  // Upload a wider set of source map artifacts (catches dynamic imports)
  widenClientFileUpload: true,

  // Strip source maps from the public bundle — only upload to Sentry
  hideSourceMaps: true,

  // Remove Sentry SDK debug logging from production bundle (~10 KB saving)
  disableLogger: true,

  // Automatically instrument Vercel Cron routes as Sentry Cron Monitors
  automaticVercelMonitors: true,
});
