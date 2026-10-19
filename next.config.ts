import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)' },
];

const isStaticExport =
  process.env.CAPACITOR_BUILD === 'true' ||
  process.env.NEXT_EXPORT === 'true' ||
  process.env.npm_lifecycle_event === 'build:cap';

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: 'export',
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        async headers() {
          return [
            {
              source: '/(.*)',
              headers: securityHeaders,
            },
          ];
        },
      }),
};

export default nextConfig;
