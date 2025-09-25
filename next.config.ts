import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 実験的機能の有効化
  experimental: {
    optimizeCss: true, // CSS最適化
  },
  // 画像の最適化
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // ESLintをビルド時に無視
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScriptエラーをビルド時に無視（必要に応じて）
  typescript: {
    ignoreBuildErrors: false,
  },
  // webpack設定でバンドルサイズを最適化
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // クライアントサイドのバンドル最適化
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
        },
      };
    }
    return config;
  },
};

export default nextConfig;
