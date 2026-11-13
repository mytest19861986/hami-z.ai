"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BrandMark, Shamseh } from "@/components/shared/brand"
import { toFaDigits } from "@/lib/jalali"

export interface BannerSlide {
  id: string
  imageUrl: string
  title: string | null
  linkUrl: string | null
}

/** طرح پیشنهادی زیر کارت برند (از طرح‌های فعال صفحه اصلی) */
export interface RecommendedPlan {
  title: string
  price: string
  durationDays: number
}

/**
 * اسلایدر بنرهای صفحهٔ اصلی (جایگاه «عکس کارت» در هیرو).
 * اسلاید اول همیشه «کارت برند پیش‌فرض» است (ماکاپ زیبای قدیمی: شمسه + گره‌چینی + نشان طلایی + نوار طرح پیشنهادی)
 * و بنرهای فعال ادمین پس از آن هر ۵ ثانیه چرخش می‌کنند.
 * نکته: سرور هم اسلاید اول را رندر می‌کند (index=0 پیش‌فرض) تا بدون جاوااسکریپت صفحه کامل باشد.
 */
export function HomepageBannerSlider({
  banners,
  recommendedPlan,
}: {
  banners: BannerSlide[]
  recommendedPlan?: RecommendedPlan | null
}) {
  const [index, setIndex] = useState(0)
  const total = 1 + banners.length // کارت برند + بنرها

  useEffect(() => {
    if (total <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % total), 5000)
    return () => clearInterval(t)
  }, [total])

  const currentBanner = index > 0 ? banners[index - 1] : null

  return (
    <div className="relative mx-auto max-w-sm">
      <div className="pointer-events-none absolute -top-16 -left-14 text-gold/50">
        <Shamseh size={150} />
      </div>

      {/* اسلاید ۱ (همیشگی) — کارت برند پیش‌فرض */}
      <div className={index === 0 ? "block" : "hidden"} aria-hidden={index !== 0}>
        <div className="bg-brand-navy relative overflow-hidden rounded-3xl p-6 text-sidebar-foreground shadow-float rotate-[-2deg]">
          <div className="bg-girih-light absolute inset-0" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <BrandMark size={40} />
                <div className="leading-tight">
                  <div className="font-display text-sm font-bold">کارت حامی‌کارت</div>
                  <div className="mt-0.5 text-[10px] text-sidebar-foreground/60">عضویت فعال خدمات درمانی</div>
                </div>
              </div>
              <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold text-sidebar">عضویت</span>
            </div>
            <div className="mt-8 flex items-end justify-between border-t border-sidebar-border pt-4">
              <div>
                <div className="text-[10px] text-sidebar-foreground/70">دارندهٔ کارت</div>
                <div className="mt-1 text-sm font-semibold">عضو حامی‌کارت</div>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-sidebar-foreground/70">تخفیف ویزیت</div>
                <div className="font-display mt-0.5 text-xl font-extrabold tabular-nums text-gold">۳۰٪</div>
              </div>
            </div>
          </div>
        </div>
        {recommendedPlan ? (
          <div className="relative z-10 mx-auto -mt-3 mr-8 w-fit rotate-[1.5deg] rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
            <div className="text-xs font-semibold">طرح پیشنهادی: {recommendedPlan.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-primary">{recommendedPlan.price}</span>
              <span>· {toFaDigits(recommendedPlan.durationDays)} روز اعتبار</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* اسلایدهای بنر ادمین — فقط اسلاید فعال نمایان */}
      {banners.map((slide, i) => (
        <div key={slide.id} className={i === index - 1 ? "block" : "hidden"} aria-hidden={i !== index - 1}>
          <div className="relative overflow-hidden rounded-3xl shadow-float">
            {slide.linkUrl ? (
              <Link href={slide.linkUrl} target={slide.linkUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                <img src={slide.imageUrl} alt={slide.title ?? "بنر حامی‌کارت"} className="aspect-[4/3] w-full object-cover" />
              </Link>
            ) : (
              <img src={slide.imageUrl} alt={slide.title ?? "بنر حامی‌کارت"} className="aspect-[4/3] w-full object-cover" />
            )}
            {/* عنوان بنر روی عکس */}
            {slide.title ? (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
                <p className="text-sm font-bold text-white drop-shadow">{slide.title}</p>
              </div>
            ) : null}
          </div>
        </div>
      ))}

      {/* نشانگر اسلایدها (کارت برند + بنرها) + نشان برند */}
      <div className="mt-3 flex flex-col items-center gap-2">
        {total > 1 ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="کارت برند"
              onClick={() => setIndex(0)}
              className={`h-1.5 rounded-full transition-all ${index === 0 ? "w-5 bg-primary" : "w-1.5 bg-primary/30 hover:bg-primary/60"}`}
            />
            {banners.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`اسلاید بنر ${i + 1}`}
                onClick={() => setIndex(i + 1)}
                className={`h-1.5 rounded-full transition-all ${i === index - 1 ? "w-5 bg-primary" : "w-1.5 bg-primary/30 hover:bg-primary/60"}`}
              />
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2 opacity-60">
          <BrandMark size={18} />
          <span className="text-[10px] text-muted-foreground">حامی‌کارت</span>
        </div>
      </div>
    </div>
  )
}
