import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: {
    default: "حامی‌کارت | سامانه عضویت و تخفیف خدمات درمانی",
    template: "%s | حامی‌کارت",
  },
  description:
    "حامی‌کارت — سامانه عضویت، تخفیف خدمات درمانی، شبکه پزشکان و نمایندگان فروش. طرح مناسب خود را تهیه کنید و از شبکه پزشکان طرف همکاری در سراسر ایران با تخفیف استفاده کنید.",
  keywords: ["حامی‌کارت", "تخفیف پزشکی", "خدمات درمانی", "عضویت درمانی", "پزشکان طرف قرارداد"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
      </head>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
