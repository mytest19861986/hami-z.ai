import { cn } from "@/lib/utils"

/**
 * نشان برند حامی‌کارت — کاشی «شمسه» (ستارهٔ هشت‌پر) با خط نبض در میانه.
 * طراحی اختصاصی؛ جایگزین آیکون‌های عمومی می‌شود تا هویت مستقل داشته باشد.
 */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#2a4494" />
      <g stroke="#f6f1e7" strokeOpacity="0.78" strokeWidth="2">
        <rect x="15.5" y="15.5" width="17" height="17" />
        <rect x="15.5" y="15.5" width="17" height="17" transform="rotate(45 24 24)" />
      </g>
      <path
        d="M12 24h6.2l2.6-6 4.4 12 3-6H36"
        stroke="#d9942b"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="24" cy="24" r="2" fill="#d9942b" />
    </svg>
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
