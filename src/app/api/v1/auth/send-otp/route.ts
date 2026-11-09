import { NextRequest } from "next/server"
import { z } from "zod"
import { sendOtp } from "@/lib/otp"
import { ok, fail, parseBody, clientIp } from "@/lib/api"
import { db } from "@/lib/db"
import { mobileSchema } from "@/lib/validators"

// سقف درخواست کد از هر IP در ساعت (SEC: ضد بمباران پیامکی/شماره‌گردشی)
// شل‌تر از سقف هر شماره، چون پشت پروکسی پیش‌نمایش همه یک IP لبهٔ مشترک دارند
const IP_HOUR_LIMIT = 40

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, z.object({ mobile: mobileSchema }))
  if ("response" in parsed) return parsed.response
  const { mobile } = parsed.data

  const ip = clientIp(req)
  if (ip) {
    // فقط ارسال‌های واقعی (success) شمرده می‌شوند؛ پاسخ‌های 429 خودشان شمارنده را
    // افزایش نمی‌دهند تا قفلِ خودتقویت‌شونده برای کاربر سالم ساخته نشود.
    const sendsFromIp = await db.loginLog.count({
      where: { ip, method: "OTP", success: true, createdAt: { gte: new Date(Date.now() - 3600_000) } },
    })
    if (sendsFromIp >= IP_HOUR_LIMIT) {
      await db.loginLog.create({
        data: { mobile, method: "OTP", success: false, failReason: "IP_RATE_LIMITED", ip, userAgent: req.headers.get("user-agent") },
      })
      return fail("تعداد درخواست کد از این اتصال بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.", 429, { retryAfterSec: 3600 })
    }
  }

  const user = await db.user.findUnique({ where: { mobile } })
  if (user && user.status !== "ACTIVE") {
    // پیام محافظه‌کارانه بدون افشای جزئیات (AUTH-008)
    return fail("امکان ورود با این شماره در حال حاضر وجود ندارد. با پشتیبانی تماس بگیرید.", 403)
  }

  const result = await sendOtp(mobile)
  if (!result.ok) return fail(result.error ?? "خطا در ارسال کد.", 429, { retryAfterSec: result.retryAfterSec })

  await db.loginLog.create({
    data: { mobile, method: "OTP", success: true, failReason: null, ip, userAgent: req.headers.get("user-agent") },
  })

  // پیامک واقعی متصل نیست — وضعیت صادقانه (PRD ۲.۳ / NOTICE-003)
  return ok({
    sent: true,
    smsConnected: false,
    message: "سرویس پیامک واقعی هنوز متصل نشده است؛ کد تأیید آزمایشی در همین صفحه نمایش داده می‌شود.",
    devCode: result.devCode ?? null,
  })
}
