"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BrandMark, Shamseh } from "@/components/shared/brand"

export interface BannerSlide {
  id: string
  imageUrl: string
  title: string | null
  linkUrl: string | null
}

/**
 * اسلایدر بنرهای صفحهٔ اصلی (جایگاه «عکس کارت» در هیرو).
 * بنرهای فعال هر ۵ ثانیه چرخش می‌کنند؛ بدون بنر فعال، کارت پیش‌فرض برند نمایش داده می‌شود.
 * نکته: سرور همان کارت پیش‌فرض را هم رندر می‌کند تا بدون جاوااسکریپت صفحه کامل باشد.
 */
export function HomepageBannerSlider({ banners, fallback }: { banners: BannerSlide[]; fallback: React.ReactNode }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 5000)
    return () => clearInterval(t)
  }, [banners.length])

  if (banners.length === 0) return <>{fallback}</>

  const b = banners[index]

  return (
    <div className="relative mx-auto max-w-sm">
      <div className="pointer-events-none absolute -top-16 -left-14 text-gold/50">
        <Shamseh size={150} />
      </div>
      <div className="relative overflow-hidden rounded-xl shadow-xl shadow-sidebar/25">
        {/* اسلایدها — فقط اسلاید فعال نمایان */}
        {banners.map((slide, i) => (
          <div key={slide.id} className={i === index ? "block" : "hidden"} aria-hidden={i !== index}>
            {slide.linkUrl ? (
              <Link href={slide.linkUrl} target={slide.linkUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            { }
                <img src={slide.imageUrl} alt={slide.title ?? "بنر حامی‌کارت"} className="aspect-[4/3] w-full object-cover" />
              </Link>
            ) : (
               
              <img src={slide.imageUrl} alt={slide.title ?? "بنر حامی‌کارت"} className="aspect-[4/3] w-full object-cover" />
            )}
          </div>
        ))}

        {/* عنوان بنر روی عکس */}
        {b.title ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
            <p className="text-sm font-bold text-white drop-shadow">{b.title}</p>
          </div>
        ) : null}

        {/* نشانگر اسلایدها */}
        {banners.length > 1 ? (
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {banners.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`اسلاید ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/60 hover:bg-white"}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 opacity-60">
        <BrandMark size={18} />
        <span className="text-[10px] text-muted-foreground">حامی‌کارت</span>
      </div>
    </div>
  )
}
