import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API body size制限を増加（大きな画像のアップロードに対応）
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
