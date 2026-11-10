import { BrandMark } from "@/components/shared/brand"

export const metadata = {
  title: "حالت آفلاین",
}

/** پوستهٔ آفلاین — توسط Service Worker در نبود شبکه سرو می‌شود. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 blur-3xl">
          <BrandMark size={180} className="opacity-20" />
        </div>
        <BrandMark size={88} />
      </div>
      <h1 className="mt-6 font-display text-xl font-bold text-foreground sm:text-2xl">
        اتصال اینترنت برقرار نیست
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
        حامی‌کارت در حالت آفلاین است. صفحات بازدیدشدهٔ پیشین همچنان در دسترس‌اند؛
        برای استفاده از همهٔ امکانات — استعلام، ثبت ویزیت و خرید طرح — لطفاً اتصال
        خود را بررسی کنید.
      </p>
      <a
        href="/"
        className="mt-7 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        تلاش دوباره
      </a>
    </main>
  )
}
