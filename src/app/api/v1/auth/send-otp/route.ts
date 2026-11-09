import { NextRequest } from "next/server"
import { z } from "zod"
import { sendOtp } from "@/lib/otp"
import { ok, fail, parseBody, clientIp } from "@/lib/api"
import { db } from "@/lib/db"
import { mobileSchema } from "@/lib/validators"

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, z.object({ mobile: mobileSchema }))
  if ("response" in parsed) return parsed.response
  const { mobile } = parsed.data

  const user = await db.user.findUnique({ where: { mobile } })
  if (user && user.status !== "ACTIVE") {
    // پیام محافظه‌کارانه بدون افشای جزئیات (AUTH-008)
    return fail("امکان ورود با این شماره در حال حاضر وجود ندارد. با پشتیبانی تماس بگیرید.", 403)
  }

  const result = await sendOtp(mobile)
  if (!result.ok) return fail(result.error ?? "خطا در ارسال کد.", 429, { retryAfterSec: result.retryAfterSec })

  const ip = clientIp(req)
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
