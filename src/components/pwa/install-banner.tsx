"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { BrandMark } from "@/components/shared/brand"
import { Button } from "@/components/ui/button"
import { X, Smartphone, Sparkles } from "lucide-react"
import {
  installNow,
  isRunningStandalone,
  markAppInstalled,
  readInstalledFlag,
  subscribeInstallState,
} from "@/lib/pwa-install"

/* ─── ثابت‌ها ─── */

const DISMISS_KEY = "hk_install_banner_dismiss_until" // مهر زمانی پایان ابطال
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000 // ۳ روز
const PROMPT_WAIT_MS = 10 * 1000 // حداکثر انتظار برای رویداد نصب مرورگر
const INSTALL_WAIT_MS = 8 * 1000 // حداکثر انتظار بعد از کلیک (نصب خودکار)

/** آیا صفحه داخل iframe اجرا می‌شود؟ (پنل پیش‌نمایش)
 *  Chrome در iframe هرگز beforeinstallprompt نمی‌دهد؛ تشخیص زودهنگام جلوی
 *  انتظار بی‌پایان و بنر ناقص را می‌گیرد.
 */
function isInIframe(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.self !== window.top
  } catch {
    // دسترسی به window.top بین‌مبدأ خطا می‌دهد → یعنی داخل iframe است
    return true
  }
}

/* ─── کامپوننت ─── */

/**
 * نوار شناور هوشمند نصب موبایل (پایین صفحه، ثابت) — شرطی.
 * • فقط وقتی ظاهر می‌شود که مرورگر رویداد beforeinstallprompt بدهد و هنوز
 *   نصبی در کار نباشد؛ بعد از نصب موفق دیگر نمایش داده نمی‌شود (دکمهٔ
 *   دائمی صفحهٔ اصلی همیشه در دسترس است).
 * • کلیک روی «نصب اپلیکیشن حامی‌کارت» = نصب تمام‌خودکار: دیالوگ بومی
 *   مرورگر باز می‌شود؛ اگر رویداد هنوز آماده نیست تا ۸ ثانیه صبر می‌کند و
 *   به محض آماده‌شدن خودش باز می‌کند.
 * • بستن → ابطال ۳ روزه در localStorage؛ نصب موفق → مخفی‌سازی همیشگی
 * • داخل iframe (پنل پیش‌نمایش)، اجرای standalone یا مسیرهای پنل نمایش داده نمی‌شود
 * • منبع رویداد نصب مشترک با دکمهٔ نصب صفحهٔ اصلی: src/lib/pwa-install.ts
 */
export function InstallBanner() {
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()

  // بنر نصب فقط برای صفحات عمومی معنا دارد؛ در پنل‌های داخلی (ادمین/کاربر/پزشک/نماینده/ورود)
  // نمایش داده نمی‌شود تا روی عناصر شناور پنل‌ها (تقویم، دراپ‌داون‌ها) نیفتد.
  const isPanelRoute =
    typeof pathname === "string" &&
    ["/admin", "/user", "/doctor", "/agent", "/auth", "/plans", "/offline"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )

  // ناوبری به مسیر پنل → بنر باید بسته شود (effect زیر فقط یک‌بار اجرا می‌شود)
  useEffect(() => {
    if (isPanelRoute) {
      setVisible(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current)
    }
  }, [isPanelRoute])

  useEffect(() => {
    if (isPanelRoute) return
    if (isInIframe()) return // داخل iframe رویداد نصب صادر نمی‌شود؛ بنر بی‌فایده است
    if (isRunningStandalone()) return // داخل خود اپ نصب‌شده
    let dismissed = false
    let availableNow = false
    let installedNow = false
    try {
      installedNow = readInstalledFlag()
      // دورهٔ ابطال ۳ روزهٔ کاربر
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
      if (Number.isFinite(until) && Date.now() < until) return
    } catch {
      /* localStorage در حالت خصوصی برخی مرورگرها خطا می‌دهد → ادامه با بنر */
    }

    const show = () => setVisible(true)
    const hide = () => setVisible(false)

    // اشتراک در وضعیت منبع مشترک نصب.
    // نکته: حتی اگر نصب شده باشیم مشترک می‌مانیم — رویداد نصبِ تازه یعنی
    // مرورگر دوباره نصب را پیشنهاد می‌دهد (سناریوی «نصب کردم، اپ را حذف کردم»)
    // و ماژول مشترک پرچم نصب را پاک می‌کند → بنر باید برگردد.
    const unsub = subscribeInstallState((state) => {
      if (state.installed) {
        dismissed = true
        hide()
        return
      }
      if (state.standalone) {
        dismissed = true
        hide()
        return
      }
      availableNow = state.available
      if (state.available && !dismissed) {
        // رویداد تازه بعد از نصب قبلی → پرچم پاک شده، بنر دوباره مجاز است
        dismissed = false
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(show, 700)
      }
    })

    // اگر رویداد نصب ظرف مهلت مشخص نیامد (مرورگر نصب عرضه نمی‌کند)، بنر را
    // نشان نمی‌دهیم — دکمهٔ دائمی صفحهٔ اصلی خودش صبر می‌کند و نصب می‌کند.
    // اگر از قبل نصب شده باشد هم بنری نیست (رویداد تازه اگر بیاید، بالا برمی‌گرداند).
    waitTimerRef.current = setTimeout(() => {
      if (dismissed || availableNow || installedNow) return
      cleanup()
    }, PROMPT_WAIT_MS)

    function cleanup() {
      unsub()
      if (timerRef.current) clearTimeout(timerRef.current)
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current)
    }
    return cleanup
  }, [])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS))
    } catch {}
    setVisible(false)
  }, [])

  const install = useCallback(async () => {
    if (installing) return
    try {
      setInstalling(true)
      const outcome = await installNow(INSTALL_WAIT_MS)
      if (outcome === "accepted") {
        markAppInstalled()
        setVisible(false)
      }
      // "dismissed" / "unavailable" → بنر می‌ماند؛ کاربر می‌تواند دوباره بزند یا ببندد
    } finally {
      setInstalling(false)
    }
  }, [installing])

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
            <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
              <Sparkles className="ml-1 inline h-3.5 w-3.5 text-gold-deep" aria-hidden />
              دسترسی سریع به کارت تخفیف، سهمیه‌ها و پزشکان طرف قرارداد — بدون
              مرورگر و حتی با اینترنت ضعیف.
            </p>
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
          <Button
            type="button"
            className="h-9 flex-1 gap-1.5 text-xs font-bold"
            onClick={install}
            disabled={installing}
          >
            <Smartphone className="h-4 w-4" aria-hidden />
            {installing ? "در حال باز کردن…" : "نصب اپلیکیشن حامی‌کارت"}
          </Button>
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
