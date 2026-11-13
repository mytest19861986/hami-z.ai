"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Smartphone, Share, MonitorSmartphone, WifiOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  detectIOS,
  markAppInstalled,
  subscribeInstallState,
  triggerInstallPrompt,
} from "@/lib/pwa-install"

/* ─── کامپوننت ─── */

/**
 * دکمهٔ «نصب اپلیکیشن» برای صفحهٔ اصلی (کنار دکمهٔ پزشکان طرف قرارداد).
 * • اندروید/کروم استاندارد: تا وقتی رویداد beforeinstallprompt نیامده دکمهٔ
 *   معمولی است؛ با کلیک، دیالوگ نصب بومی مرورگر باز می‌شود.
 * • iOS/Safari یا مرورگری که رویداد نصب نمی‌دهد: با کلیک، راهنمای گام‌به‌گام
 *   نصب (Share ← Add to Home Screen در iOS / منوی مرورگر در سایرین) باز می‌شود.
 * • اگر اپ از قبل نصب/اجرا شده باشد، دکمه رندر نمی‌شود.
 * • منبع رویداد نصب مشترک با بنر نصب: src/lib/pwa-install.ts
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [canPrompt, setCanPrompt] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const { toast } = useToast()

  // اشتراک در وضعیت نصب (سیستم بیرونی) — وضعیت اولیه هم بلافاصله از همین
  // طریق می‌رسد؛ installed شامل اجرای standalone و پرچم localStorage است.
  useEffect(() => {
    const unsub = subscribeInstallState((state) => {
      setCanPrompt(state.available && !state.installed)
      if (state.installed) {
        setHidden(true)
        setCanPrompt(false)
        setGuideOpen(false)
      }
    })
    return unsub
  }, [])

  const handleClick = useCallback(async () => {
    // ۱) مرورگرِ استاندارد و آمادهٔ نصب → دیالوگ بومی
    if (canPrompt) {
      const outcome = await triggerInstallPrompt()
      if (outcome === "accepted") {
        markAppInstalled()
        toast({ title: "حامی‌کارت نصب شد", description: "آیکون اپ به صفحهٔ اصلی گوشی شما اضافه شد." })
      } else if (outcome === null) {
        // رویداد توسط بنر مصرف شده → راهنمای دستی
        setGuideOpen(true)
      }
      return
    }
    // ۲) iOS یا مرورگر بدون رویداد نصب → راهنمای گام‌به‌گام
    setGuideOpen(true)
  }, [canPrompt, toast])

  const isIOS = detectIOS()

  if (hidden) return null

  return (
    <>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className={className ?? "h-12 px-6 text-[15px]"}
        onClick={handleClick}
        disabled={installing}
      >
        <Smartphone className="ml-1 h-4 w-4" />
        {installing ? "در حال باز کردن…" : "نصب اپلیکیشن"}
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <MonitorSmartphone className="h-5 w-5 text-primary" />
              نصب حامی‌کارت روی گوشی
            </DialogTitle>
            <DialogDescription className="text-right leading-7">
              در چند ثانیه، بدون مرورگر و حتی با اینترنت ضعیف.
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <ol className="space-y-3 text-sm leading-7">
              <li className="flex items-start gap-2.5">
                <span className="font-display mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-secondary-foreground">
                  ۱
                </span>
                <span>
                  دکمهٔ اشتراک‌گذاری{" "}
                  <Share className="mx-0.5 inline h-4 w-4 -translate-y-px text-primary" aria-label="دکمه Share در سافاری" />{" "}
                  (Share) را در نوار پایین سافاری بزنید.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-display mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-secondary-foreground">
                  ۲
                </span>
                <span>
                  گزینهٔ <b>«Add to Home Screen»</b> (افزودن به صفحهٔ اصلی) را انتخاب کنید.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-display mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-secondary-foreground">
                  ۳
                </span>
                <span>
                  روی <b>Add</b> بزنید — آیکون حامی‌کارت به صفحهٔ اصلی گوشی شما اضافه می‌شود.
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm leading-7">
              <li className="flex items-start gap-2.5">
                <span className="font-display mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-secondary-foreground">
                  ۱
                </span>
                <span>
                  منوی مرورگر را باز کنید: در کروم اندروید دکمهٔ <b>⋮</b> (سه‌نقطه)،
                  در سافاری دسکتاپ <b>File ← Share</b>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-display mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-secondary-foreground">
                  ۲
                </span>
                <span>
                  گزینهٔ <b>«Install app»</b> یا <b>«Add to Home screen»</b> /{" "}
                  <b>«افزودن به صفحهٔ اصلی»</b> را بزنید.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-display mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-secondary-foreground">
                  ۳
                </span>
                <span>تأیید کنید — حامی‌کارت مثل یک اپ واقعی نصب می‌شود.</span>
              </li>
            </ol>
          )}

          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs leading-6 text-muted-foreground">
            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" />
            پس از نصب، بخش‌هایی که یک‌بار دیده‌اید حتی بدون اینترنت هم در دسترس‌اند.
          </p>

          <Button type="button" className="w-full" onClick={() => setGuideOpen(false)}>
            متوجه شدم
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
