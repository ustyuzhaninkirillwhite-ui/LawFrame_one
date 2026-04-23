import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@lexframe/ai-gateway",
    "@lexframe/api-client",
    "@lexframe/config",
    "@lexframe/contracts",
    "@lexframe/workflow",
  ],
};

export default nextConfig;
