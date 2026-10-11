import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Evita que o Turbopack suba para um lockfile fora do repositório.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
