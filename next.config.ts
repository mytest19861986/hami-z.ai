import type { NextConfig } from "next";

// هدرهای امنیتی (SEC) — در همهٔ پاسخ‌ها اعمال می‌شود.
// نکته ۱: CSP فقط منابع هم‌مبدأ را مجاز می‌کند؛ 'unsafe-eval' برای HMR محیط توسعه لازم است.
// نکته ۲: frame-ancestors باید میزبانی برنامه در iframe چت (پیش‌نمایش) را بگذارد؛
//         به همین دلیل فقط پروتکل https محدود شده و دامنهٔ خاصی تحمیل نشده است.
// نکته ۳: HSTS فقط روی HTTPS توسط مرورگر اعمال می‌شود و در HTTP نادیده گرفته می‌شود.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self' https: http://localhost:* http://127.0.0.1:*",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
