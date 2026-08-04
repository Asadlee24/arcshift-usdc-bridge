import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Next.js 16 Turbopack (Vercel default) alongside webpack config
  turbopack: {
    resolveAlias: {
      '@x402/core': './lib/x402-stub.ts',
      '@x402/core/client': './lib/x402-stub.ts',
      '@x402/evm': './lib/x402-stub.ts',
      '@x402/evm/exact/client': './lib/x402-stub.ts',
      '@x402/evm/upto/client': './lib/x402-stub.ts',
      '@x402/svm': './lib/x402-stub.ts',
      '@x402/svm/exact/client': './lib/x402-stub.ts',
    },
  },
  serverExternalPackages: [
    '@coinbase/cdp-sdk',
    '@base-org/account',
    '@x402/core',
    '@x402/evm',
    '@x402/svm',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402/core': false,
      '@x402/core/client': false,
      '@x402/evm': false,
      '@x402/evm/exact/client': false,
      '@x402/evm/upto/client': false,
      '@x402/svm': false,
      '@x402/svm/exact/client': false,
    };
    
    // Set native node packages as externals to bypass compile warnings in client bundles
    config.externals = [
      ...(config.externals || []),
      'pino-pretty',
      '@react-native-async-storage/async-storage',
      'encoding',
      'lokijs',
    ];

    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
