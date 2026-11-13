"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Smartphone, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { installNow, markAppInstalled, isRunningStandalone } from "@/lib/pwa-install"

/* ─── ثابت‌ها ─── */

/** حداکثر انتظار برای آماده‌شدن رویداد نصب پس از کلیک (میلی‌ثانیه) */
const INSTALL_WAIT_MS = 8_000

/* ─── کامپوننت ─── */

/**
 * دکمهٔ «نصب اپلیکیشن» صفحهٔ اصلی (کنار دکمهٔ پزشکان طرف قرارداد) — دائمی.
 * • دکمه همیشه نمایش داده می‌شود؛ نصب بودن اپ آن را پنهان نمی‌کند (برخلاف
 *   بنر که بعد از نصب دیگر نمی‌آید). کاربر ممکن است اپ را حذف کرده باشد و
 *   دوباره بخواهد نصب کند — این دکمه همیشه در دسترس است.
 * • تنها استثنا: اجرا داخل خودِ اپ نصب‌شده (standalone) — آنجا دکمهٔ نصب
 *   بی‌معنی است.
 * • کلیک = نصب تمام‌خودکار: دیالوگ بومی نصب مرورگر باز می‌شود؛ اگر رویداد
 *   هنوز آماده نیست حداکثر ۸ ثانیه صبر می‌کنیم و به محض آماده‌شدن، خودکار
 *   باز می‌شود (بدون راهنمای دستی).
 * • منبع رویداد نصب مشترک با بنر نصب: src/lib/pwa-install.ts
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [standalone, setStandalone] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [justInstalled, setJustInstalled] = useState(false)
  const { toast } = useToast()

  // تشخیص اجرای standalone فقط یک‌بار در mount (خواندن شرط محیط، نه setState
  // بی‌دلیل در effect — مقدار در طول عمر صفحه ثابت است)
  useEffect(() => {
    setStandalone(isRunningStandalone())
  }, [])

  const handleClick = useCallback(async () => {
    if (installing) return
    setInstalling(true)
    try {
      const outcome = await installNow(INSTALL_WAIT_MS)
      if (outcome === "accepted") {
        markAppInstalled()
        setJustInstalled(true)
        toast({
          title: "حامی‌کارت نصب شد",
          description: "آیکون اپ به صفحهٔ اصلی گوشی شما اضافه شد.",
        })
        // بعد از چند ثانیه به حالت عادی برگردد (کاربر شاید دوباره بخواهد نصب کند)
        setTimeout(() => setJustInstalled(false), 6000)
      } else if (outcome === "unavailable") {
        toast({
          title: "نصب موقتاً در دسترس نیست",
          description: "مرورگر هنوز آمادهٔ نصب نیست؛ چند لحظه بعد دوباره امتحان کنید.",
        })
      }
      // "dismissed": کاربر دیالوگ را بست — بی‌صدا، دکمه برای همیشه در دسترس است
    } finally {
      setInstalling(false)
    }
  }, [installing, toast])

  if (standalone) return null

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      className={className ?? "h-12 px-6 text-[15px]"}
      onClick={handleClick}
      disabled={installing}
    >
      {justInstalled ? <Check className="ml-1 h-4 w-4 text-green-600" /> : <Smartphone className="ml-1 h-4 w-4" />}
      {installing ? "در حال باز کردن…" : justInstalled ? "نصب شد" : "نصب اپلیکیشن"}
    </Button>
  )
}
