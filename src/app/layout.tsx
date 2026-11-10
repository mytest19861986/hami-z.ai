import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/pwa/register-sw";
import { InstallBanner } from "@/components/pwa/install-banner";

// فونت‌های میزبانی‌شده محلی — بدون وابستگی به CDN بیرونی (SEC/PRIV)
const vazir = localFont({
  src: [
    { path: "./fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Vazirmatn-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-vazir",
  display: "swap",
});

const estedad = localFont({
  src: [
    { path: "./fonts/Estedad-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Estedad-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Estedad-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Estedad-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-estedad",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "حامی‌کارت | سامانه عضویت و تخفیف خدمات درمانی",
    template: "%s | حامی‌کارت",
  },
  description:
    "حامی‌کارت — سامانه عضویت، تخفیف خدمات درمانی، شبکه پزشکان و نمایندگان فروش. طرح مناسب خود را تهیه کنید و از شبکه پزشکان طرف همکاری در سراسر ایران با تخفیف استفاده کنید.",
  keywords: ["حامی‌کارت", "تخفیف پزشکی", "خدمات درمانی", "عضویت درمانی", "پزشکان طرف قرارداد"],
  /* ── PWA ── */
  manifest: "/manifest.json",
  applicationName: "حامی‌کارت",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "حامی‌کارت",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2a4494",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className={`${vazir.variable} ${estedad.variable}`}>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster />
        <ServiceWorkerRegister />
        <InstallBanner />
      </body>
    </html>
  );
}
