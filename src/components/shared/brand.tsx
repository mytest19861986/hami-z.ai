import { cn } from "@/lib/utils"

/**
 * نشان برند حامی‌کارت — لوگوی اصلی برند (لوگوی اختصاصی کارفرما)
 * روی کاشی سفید گردگوشه تا در هر زمینه‌ای (روشن/تیره) تضاد داشته باشد.
 */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[26%] bg-white shadow-sm ring-1 ring-black/10",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo.png"
        alt=""
        width={size}
        height={size}
        className="h-[88%] w-[88%] object-contain"
        draggable={false}
      />
    </span>
  )
}

/** لوگوی کامل: نشان + نام برند */
export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={compact ? 30 : 36} />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold tracking-tight">حامی‌کارت</span>
          <span className="mt-1 text-[10px] font-medium text-muted-foreground">تخفیف واقعی خدمات درمانی</span>
        </span>
      ) : (
        <span className="font-display text-base font-bold">حامی‌کارت</span>
      )}
    </span>
  )
}

/** مدال تزئینی شمسه — برای هیرو، ورود و فوتر */
export function Shamseh({ size = 320, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.1">
        <rect x="56" y="56" width="88" height="88" />
        <rect x="56" y="56" width="88" height="88" transform="rotate(45 100 100)" />
        <rect x="38" y="38" width="124" height="124" />
        <rect x="38" y="38" width="124" height="124" transform="rotate(45 100 100)" />
        <circle cx="100" cy="100" r="20" />
        <circle cx="100" cy="100" r="6" />
        <path d="M100 6v18M100 176v18M6 100h18M176 100h18" />
        <path d="M33.5 33.5l12.7 12.7M153.8 153.8l12.7 12.7M166.5 33.5l-12.7 12.7M46.2 153.8 33.5 166.5" />
      </g>
    </svg>
  )
}
