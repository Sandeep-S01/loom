import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@clm/shared-types", "@clm/shared-utils"],
};

export default nextConfig;
