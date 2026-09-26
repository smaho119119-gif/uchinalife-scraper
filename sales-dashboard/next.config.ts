import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 親フォルダ（/Users/hiroki）にも package-lock.json があり、Turbopack がそこを根と誤認する。
  // 根が日本語のフォルダ名を含むと Turbopack が落ちる（char boundary panic）ので、このフォルダに固定する
  turbopack: {
    root: path.resolve("."),
  },
  // API body size制限を増加（大きな画像のアップロードに対応）
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
