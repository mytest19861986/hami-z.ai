"use client"

/* ─── منبع واحد رویداد نصب PWA ───
 * هم بنر نصب (install-banner) و هم دکمهٔ نصب صفحهٔ اصلی (install-app-button)
 * از همین ماژول استفاده می‌کنند:
 *  • شنوندهٔ beforeinstallprompt فقط یک‌بار (با گارد window) ثبت می‌شود —
 *    حتی با HMR در dev تکراری نمی‌شود.
 *  • رویدادِ قبل از mount (hydration کند) در مخزن نگه داشته می‌شود و از دست نمی‌رود.
 *  • مصرف رویداد (prompt) متمرکز است: اولین مصرف‌کننده برنده می‌شود، دومی
 *    به‌جای خطا، null می‌گیرد.
 *  • پرچم «نصب شده» با آمدن رویداد نصبِ تازه پاک می‌شود — سناریوی
 *    «نصب کردم، اپ را حذف کردم» دیگر بنر را برای همیشه نمی‌بندد.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const INSTALLED_KEY = "hk_app_installed" // نصب قطعی → بنر دیگر نشان نده

let stashedPrompt: BeforeInstallPromptEvent | null = null

/** منتظرمانده‌های رویداد نصب (waitForInstallPrompt) */
const waiters = new Set<(ev: BeforeInstallPromptEvent) => void>()

export interface InstallState {
  /** رویداد نصب مرورگر آماده است (دیالوگ بومی قابل بازکردن است) */
  available: boolean
  /** اپ نصب شده (رویداد appinstalled یا انتخاب accepted کاربر) */
  installed: boolean
  /** اجرا داخل پنجرهٔ اپ نصب‌شده (standalone) است */
  standalone: boolean
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

/** آیا صفحه داخل پنجرهٔ اپ نصب‌شده (standalone) اجرا می‌شود؟ */
export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false
  const standaloneQuery =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches
  const iOSStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return Boolean(standaloneQuery) || iOSStandalone
}

/** پرچم «نصب شده» از localStorage (بدون احتساب حالت standalone) */
export function readInstalledFlag(): boolean {
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
  return {
    available: Boolean(stashedPrompt),
    installed: readInstalledFlag(),
    standalone: isRunningStandalone(),
  }
}

function emitChange() {
  window.dispatchEvent(new CustomEvent<InstallState>("hk-install-change", { detail: currentState() }))
}

if (typeof window !== "undefined" && !(window as unknown as { __hkPwaInit?: boolean }).__hkPwaInit) {
  ;(window as unknown as { __hkPwaInit?: boolean }).__hkPwaInit = true
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    stashedPrompt = e as BeforeInstallPromptEvent
    // رویداد نصبِ تازه یعنی مرورگر دوباره نصب را پیشنهاد می‌دهد (اپ حذف شده یا
    // نخستین بار است) → پرچم «نصب شده»ی قدیمی را پاک کن تا بنر برگردد
    try {
      localStorage.removeItem(INSTALLED_KEY)
    } catch {}
    emitChange()
    // منتظرمانده‌ها را بیدار کن
    waiters.forEach((w) => w(stashedPrompt!))
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
 * صبر برای آماده‌شدن رویداد نصب — اگر همین حالا آماده است بیدرنگ برمی‌گردد؛
 * وگرنه حداکثر timeoutMs روی آمدن رویداد انتظار می‌کشد و به محض رسیدن،
 * همان رویداد را برمی‌گرداند (null = در مهلت مقرر نیامد).
 */
export function waitForInstallPrompt(timeoutMs: number): Promise<BeforeInstallPromptEvent | null> {
  if (stashedPrompt) return Promise.resolve(stashedPrompt)
  return new Promise((resolve) => {
    let done = false
    const onPrompt = (ev: BeforeInstallPromptEvent) => {
      if (done) return
      done = true
      clearTimeout(timer)
      waiters.delete(onPrompt)
      resolve(ev)
    }
    const timer = setTimeout(() => {
      if (done) return
      done = true
      waiters.delete(onPrompt)
      resolve(null)
    }, timeoutMs)
    waiters.add(onPrompt)
  })
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
 * نصب تمام‌خودکار: اگر رویداد نصب آماده است بیدرنگ دیالوگ بومی را باز می‌کند؛
 * وگرنه حداکثر timeoutMs صبر می‌کند و به محض آماده‌شدن رویداد، خودش باز می‌کند.
 * خروجی: "accepted" | "dismissed" | "unavailable" (در مهلت مقرر رویداد نیامد
 * یا توسط مصرف‌کنندهٔ دیگر خرج شد).
 */
export async function installNow(timeoutMs: number): Promise<"accepted" | "dismissed" | "unavailable"> {
  const ev = stashedPrompt ?? (await waitForInstallPrompt(timeoutMs))
  if (!ev) return "unavailable"
  try {
    await ev.prompt()
  } catch {
    // رویداد توسط مصرف‌کنندهٔ دیگر خرج شده یا منقضی شده است
    stashedPrompt = null
    emitChange()
    return "unavailable"
  }
  const choice = await ev.userChoice.catch(() => null)
  stashedPrompt = null
  emitChange()
  return choice?.outcome ?? "dismissed"
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
