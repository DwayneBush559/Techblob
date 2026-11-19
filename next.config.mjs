/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The local preview and the full check build against a one-connection local database (PGlite), so they build
  // with one worker. Normal builds keep Next's default parallelism.
  ...(process.env.TECHBLOB_SINGLE_BUILD_WORKER === "1" ? { experimental: { cpus: 1, workerThreads: false } } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**.ytimg.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/videos/:id/stream",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
