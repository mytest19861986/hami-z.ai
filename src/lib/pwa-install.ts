"use client"

/* ─── منبع واحد رویداد نصب PWA ───
 * هم بنر نصب (install-banner) و هم دکمهٔ نصب صفحهٔ اصلی (install-app-button)
 * از همین ماژول استفاده می‌کنند:
 *  • شنوندهٔ beforeinstallprompt فقط یک‌بار (با گارد window) ثبت می‌شود —
 *    حتی با HMR در dev تکراری نمی‌شود.
 *  • رویدادِ قبل از mount (hydration کند) در مخزن نگه داشته می‌شود و از دست نمی‌رود.
 *  • مصرف رویداد (prompt) متمرکز است: اولین مصرف‌کننده برنده می‌شود، دومی
 *    به‌جای خطا، null می‌گیرد و به راهنمای دستی می‌رود.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const INSTALLED_KEY = "hk_app_installed" // نصب قطعی → هرگز نشان نده

let stashedPrompt: BeforeInstallPromptEvent | null = null

export interface InstallState {
  /** رویداد نصب مرورگر آماده است (دکمهٔ نصب بومی قابل نمایش) */
  available: boolean
  /** اپ نصب/اجرا شده (appinstalled، localStorage یا اجرای standalone) */
  installed: boolean
}

/** iOS / iPadOS؟ (iPadOS 13+ خود را Mac جا می‌زند) */
export function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isIPadOS =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  return isIOS || isIPadOS
}

/** آیا اپ از قبل به‌صورت PWA نصب/اجرا شده؟ (پرچم localStorage یا حالت standalone) */
export function isAppInstalled(): boolean {
  if (typeof window !== "undefined") {
    // اجرای standalone = همان اپ نصب‌شده است
    const standaloneQuery =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.matchMedia?.("(display-mode: minimal-ui)").matches
    const iOSStandalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standaloneQuery || iOSStandalone) return true
  }
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1"
  } catch {
    return false
  }
}

/* ─── کانال انتشار تغییرات ───
 * توزیع از طریق CustomEvent روی window — با HMR هم امن است چون شنونده‌ها
 * به window وصل‌اند نه به Set داخل ماژول (که در HMR از نو ساخته می‌شود).
 */

function currentState(): InstallState {
  return { available: Boolean(stashedPrompt), installed: isAppInstalled() }
}

function emitChange() {
  window.dispatchEvent(new CustomEvent<InstallState>("hk-install-change", { detail: currentState() }))
}

if (typeof window !== "undefined" && !(window as unknown as { __hkPwaInit?: boolean }).__hkPwaInit) {
  ;(window as unknown as { __hkPwaInit?: boolean }).__hkPwaInit = true
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    stashedPrompt = e as BeforeInstallPromptEvent
    emitChange()
  })
  window.addEventListener("appinstalled", () => {
    stashedPrompt = null
    try {
      localStorage.setItem(INSTALLED_KEY, "1")
    } catch {}
    emitChange()
  })
}

/** رویداد نصب آماده است؟ */
export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return stashedPrompt
}

/** ثبت نصب موفق (برای انتخاب accepted کاربر) */
export function markAppInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, "1")
  } catch {}
  stashedPrompt = null
  if (typeof window !== "undefined") emitChange()
}

/**
 * بازکردن دیالوگ نصب بومی مرورگر.
 * خروجی: "accepted" | "dismissed" | null (رویداد نبود / توسط مصرف‌کنندهٔ دیگر خرج شده)
 */
export async function triggerInstallPrompt(): Promise<"accepted" | "dismissed" | null> {
  const ev = stashedPrompt
  if (!ev) return null
  try {
    await ev.prompt()
    const choice = await ev.userChoice.catch(() => null)
    stashedPrompt = null
    emitChange()
    return choice?.outcome ?? null
  } catch {
    // رویداد توسط مصرف‌کنندهٔ دیگر (بنر/دکمه) خرج شده یا منقضی شده است
    stashedPrompt = null
    emitChange()
    return null
  }
}

/**
 * اشتراک در تغییر وضعیت نصب. بلافاصله با وضعیت فعلی صدا زده می‌شود.
 * خروجی: تابع لغو اشتراک.
 */
export function subscribeInstallState(cb: (state: InstallState) => void): () => void {
  const listener = (e: Event) => cb((e as CustomEvent<InstallState>).detail)
  window.addEventListener("hk-install-change", listener)
  // وضعیت فعلی را بلافاصله اعلام کن (سینک، خارج از چرخهٔ effect)
  cb(currentState())
  return () => window.removeEventListener("hk-install-change", listener)
}
