/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
