import { NextRequest, NextResponse } from "next/server"

/**
 * حفاظت CSRF برای فراخوانی‌های تغییردهندهٔ API (SEC):
 * - مرورگرهای مدرن: سرصفحهٔ Sec-Fetch-Site جعلی‌نشدنی است؛ هر چیز به‌جز same-origin/same-site/none رد می‌شود.
 * - مرورگرهای قدیمی‌تر: بررسی تطابق Origin با میزبان (با تحمل بازنویسی Host پشت پروکسی و دامنهٔ سرو).
 * - کلاینت‌های غیرمرورگری (بدون Origin و بدون Sec-Fetch-Site) مجازند؛ کوکی مرورگر ندارند.
 * نکته: بدنهٔ غیرJSON هم پیش‌تر در parseBody رد می‌شود؛ بنابراین ارسال فرم متقاطع نیز کار نمی‌کند.
 */
function csrfBlocked(req: NextRequest): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site")
  if (secFetchSite) {
    return secFetchSite !== "same-origin" && secFetchSite !== "same-site" && secFetchSite !== "none"
  }
  const origin = req.headers.get("origin")
  if (!origin) return false
  try {
    const originHost = new URL(origin).hostname
    const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0]
    if (originHost === host) return false
    // پشت پروکسی پیش‌نمایش، Host به نام داخلی بازنویسی می‌شود؛ مبدأ دامنهٔ سرو مجاز است
    if (originHost.endsWith(".space-z.ai")) return false
    if (host === "localhost" || host === "127.0.0.1") {
      return originHost !== "localhost" && originHost !== "127.0.0.1"
    }
    return true
  } catch {
    return true
  }
}

export function middleware(req: NextRequest) {
  const mutating = req.method !== "GET" && req.method !== "HEAD"
  if (mutating && req.nextUrl.pathname.startsWith("/api/") && csrfBlocked(req)) {
    return NextResponse.json({ ok: false, error: "درخواست متقاطع غیرمجاز است." }, { status: 403 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
