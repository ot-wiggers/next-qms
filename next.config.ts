import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Für das Docker-Image (Dockerfile): eigenständiger Server ohne volles node_modules
  output: "standalone",
};

export default nextConfig;
