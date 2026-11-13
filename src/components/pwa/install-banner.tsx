"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { BrandMark } from "@/components/shared/brand"
import { Button } from "@/components/ui/button"
import { Share, X, Smartphone, Sparkles } from "lucide-react"

/* ─── انواع و ثابت‌ها ─── */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISS_KEY = "hk_install_banner_dismiss_until" // مهر زمانی پایان ابطال
const INSTALLED_KEY = "hk_app_installed" // نصب قطعی → هرگز نشان نده
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000 // ۳ روز

/** iOS / iPadOS؟ (iPadOS 13+ خود را Mac جا می‌زند) */
function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isIPadOS =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  return isIOS || isIPadOS
}

/** آیا اپ از قبل به‌صورت PWA نصب/اجرا شده؟ */
function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false
  const standaloneQuery =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches
  const iOSStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return Boolean(standaloneQuery) || iOSStandalone
}

/* ─── کامپوننت ─── */

/**
 * نوار شناور هوشمند نصب موبایل (پایین صفحه، ثابت).
 * • اندروید/مرورگرهای استاندارد: شنود beforeinstallprompt + دکمهٔ «نصب اپلیکیشن حامی‌کارت»
 * • iOS/Safari: راهنمای تصویری دکمهٔ Share و «Add to Home Screen»
 * • بستن → ابطال ۳ روزه در localStorage؛ نصب موفق → مخفی‌سازی همیشگی
 */
export function InstallBanner() {
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()

  // بنر نصب فقط برای صفحات عمومی معنا دارد؛ در پنل‌های داخلی (ادمین/کاربر/پزشک/نماینده/ورود)
  // نمایش داده نمی‌شود تا روی عناصر شناور پنل‌ها (تقویم، دراپ‌داون‌ها) نیفتد.
  const isPanelRoute =
    typeof pathname === "string" &&
    ["/admin", "/user", "/doctor", "/agent", "/auth", "/plans", "/offline"].some((p) => pathname === p || pathname.startsWith(`${p}/`))

  useEffect(() => {
    if (isPanelRoute) return
    if (isRunningStandalone()) return
    if (localStorage.getItem(INSTALLED_KEY) === "1") return
    // دورهٔ ابطال ۳ روزهٔ کاربر
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (Number.isFinite(until) && Date.now() < until) return

    const ios = detectIOS()
    setIsIOS(ios)

    // iOS: هرگز رویداد beforeinstallprompt نمی‌گیرد → مستقیم راهنما
    if (ios) {
      timerRef.current = setTimeout(() => setVisible(true), 900)
      return
    }

    // اندروید / استاندارد: منتظر رویداد نصب از مرورگر
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
      timerRef.current = setTimeout(() => setVisible(true), 700)
    }
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1")
      setVisible(false)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS))
    setVisible(false)
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return
    try {
      setInstalling(true)
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice.catch(() => null)
      if (choice?.outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "1")
      }
      setPromptEvent(null)
      setVisible(false)
    } finally {
      setInstalling(false)
    }
  }, [promptEvent])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="نصب اپلیکیشن حامی‌کارت"
      className="hk-banner-in fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
    >
      <div className="relative mx-auto max-w-lg overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl shadow-primary/25 backdrop-blur-md">
        {/* نوار تزئینی لاجورد→زعفران */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-l from-gold via-primary to-primary"
        />
        <div className="flex items-start gap-3 p-3.5 pb-0 sm:p-4 sm:pb-0">
          <BrandMark size={42} className="mt-0.5 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-display text-sm font-bold text-foreground">
              <Smartphone className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
              حامی‌کارت روی گوشی شما
            </p>
            {isIOS ? (
              <p className="mt-1.5 text-justify text-xs leading-6 text-muted-foreground">
                برای نصب حامی‌کارت روی آیفون، دکمهٔ اشتراک‌گذاری{" "}
                <Share className="mx-0.5 inline h-3.5 w-3.5 -translate-y-px text-primary" aria-label="دکمه Share در سافاری" />{" "}
                (Share) را بزنید و گزینهٔ «Add to Home Screen» را انتخاب کنید.
              </p>
            ) : (
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                <Sparkles className="ml-1 inline h-3.5 w-3.5 text-gold-deep" aria-hidden />
                دسترسی سریع به کارت تخفیف، سهمیه‌ها و پزشکان طرف قرارداد — بدون
                مرورگر و حتی با اینترنت ضعیف.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="بستن — تا سه روز دیگر نمایش داده نمی‌شود"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 p-3.5 sm:p-4">
          {isIOS ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1 text-xs font-semibold"
              onClick={dismiss}
            >
              متوجه شدم
            </Button>
          ) : (
            <Button
              type="button"
              className="h-9 flex-1 gap-1.5 text-xs font-bold"
              onClick={install}
              disabled={installing || !promptEvent}
            >
              <Smartphone className="h-4 w-4" aria-hidden />
              {installing ? "در حال باز کردن…" : "نصب اپلیکیشن حامی‌کارت"}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
            onClick={dismiss}
          >
            بعداً
          </Button>
        </div>
      </div>
    </div>
  )
}
