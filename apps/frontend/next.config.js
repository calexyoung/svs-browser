/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "svs.gsfc.nasa.gov",
        pathname: "/**",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api/v1",
  },
};

module.exports = nextConfig;
