import { NextRequest } from "next/server"
import { z } from "zod"
import { verifyOtp } from "@/lib/otp"
import { ok, fail, parseBody, clientIp } from "@/lib/api"
import { createSession } from "@/lib/auth"
import { roleHome } from "@/constants/permissions"
import { db } from "@/lib/db"
import { mobileSchema, otpSchema, toEnDigits } from "@/lib/validators"
import { resolveReferrerByCode, assignUniqueReferralCode } from "@/lib/referral"
import { genReferralCode } from "@/lib/codes"

export async function POST(req: NextRequest) {
  const parsed = await parseBody(
    req,
    z.object({
      mobile: mobileSchema,
      code: otpSchema,
      referralCode: z.string().trim().max(16).optional().or(z.literal("")), // REF-SYS: کد معرف هنگام ثبت‌نام
    })
  )
  if ("response" in parsed) return parsed.response
  const { mobile, code, referralCode } = parsed.data

  const ip = clientIp(req)
  const ua = req.headers.get("user-agent")

  // SEC: سقف تلاش ناموفق تأیید از هر IP در ۱۵ دقیقه (ضد حدس کد با چرخش شماره)
  if (ip) {
    const failsFromIp = await db.loginLog.count({
      where: { ip, method: "OTP", success: false, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } },
    })
    if (failsFromIp >= 15) {
      await db.loginLog.create({ data: { mobile, method: "OTP", success: false, failReason: "IP_VERIFY_LOCKED", ip, userAgent: ua } })
      return fail("تلاش‌های ناموفق زیاد است. ۱۵ دقیقه دیگر دوباره امتحان کنید.", 429)
    }
  }

  const verify = await verifyOtp(mobile, code)
  if (!verify.ok) {
    await db.loginLog.create({ data: { mobile, method: "OTP", success: false, failReason: verify.error, ip, userAgent: ua } })
    return fail(verify.error ?? "کد تأیید نامعتبر است.", 401)
  }

  // کاربر موجود یا ثبت‌نام جدید (AUTH-002: یک شماره = یک حساب)
  let user = await db.user.findUnique({ where: { mobile }, include: { roles: { include: { role: true } } } })
  let isNew = false
  if (!user) {
    // REF-SYS: اعتبارسنجی کد معرف پیش از ساخت حساب — کد نامعتبر مانع ثبت‌نام نمی‌شود اما اتصال انجام نمی‌گیرد
    let referredByConnect: { connect: { id: string } } | undefined
    if (referralCode) {
      const referrer = await resolveReferrerByCode(toEnDigits(referralCode))
      if (referrer && referrer.id) {
        referredByConnect = { connect: { id: referrer.id } }
      }
    }
    user = await db.user.create({
      data: {
        mobile,
        status: "ACTIVE",
        mobileVerifiedAt: new Date(),
        referralCode: await (async () => {
          // تولید کد یکتا پیش از ساخت کاربر (ستون unique اجازهٔ null می‌دهد؛ یکتایی با تلاش مجدد)
          for (let i = 0; i < 5; i++) {
            const c = genReferralCode()
            const clash = await db.user.findUnique({ where: { referralCode: c }, select: { id: true } })
            if (!clash) return c
          }
          return null
        })(),
        referredBy: referredByConnect,
        profile: { create: {} },
        roles: { create: [{ role: { connect: { name: "USER" } } }] },
      },
      include: { roles: { include: { role: true } } },
    })
    isNew = true
  } else if (user.status !== "ACTIVE") {
    return fail("حساب شما در دسترس نیست. با پشتیبانی تماس بگیرید.", 403)
  }

  // REF-SYS: کاربران قدیمی فاقد کد رفرال، به‌صورت تنبل کد یکتا می‌گیرند
  if (!user.referralCode) {
    await assignUniqueReferralCode(user.id)
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await db.loginLog.create({ data: { userId: user.id, mobile, method: "OTP", success: true, ip, userAgent: ua } })
  await createSession(user.id, ip, ua)

  const roles = user.roles.map((r) => r.role.name)
  return ok({
    isNew,
    roles,
    redirect: roleHome(roles),
    mobile: user.mobile,
  })
}
