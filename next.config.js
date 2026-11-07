/** @type {import('next').NextConfig} */
const path = require('path');

// Content Security Policy. Stripe sources follow Stripe's published CSP list
// for Stripe.js and the Payment Element. vercel.live keeps the preview
// toolbar working. Fonts are self-hosted by next/font, so no Google domains.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.stripe.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://vercel.live",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self "https://js.stripe.com")',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

module.exports = nextConfig;
