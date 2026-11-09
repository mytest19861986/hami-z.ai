import { NextRequest } from "next/server"
import { z } from "zod"
import { verifyOtp } from "@/lib/otp"
import { ok, fail, parseBody, clientIp } from "@/lib/api"
import { createSession } from "@/lib/auth"
import { roleHome } from "@/constants/permissions"
import { db } from "@/lib/db"
import { mobileSchema, otpSchema } from "@/lib/validators"

export async function POST(req: NextRequest) {
  const parsed = await parseBody(
    req,
    z.object({ mobile: mobileSchema, code: otpSchema })
  )
  if ("response" in parsed) return parsed.response
  const { mobile, code } = parsed.data

  const ip = clientIp(req)
  const ua = req.headers.get("user-agent")

  const verify = await verifyOtp(mobile, code)
  if (!verify.ok) {
    await db.loginLog.create({ data: { mobile, method: "OTP", success: false, failReason: verify.error, ip, userAgent: ua } })
    return fail(verify.error ?? "کد تأیید نامعتبر است.", 401)
  }

  // کاربر موجود یا ثبت‌نام جدید (AUTH-002: یک شماره = یک حساب)
  let user = await db.user.findUnique({ where: { mobile }, include: { roles: { include: { role: true } } } })
  let isNew = false
  if (!user) {
    user = await db.user.create({
      data: {
        mobile,
        status: "ACTIVE",
        mobileVerifiedAt: new Date(),
        profile: { create: {} },
        roles: { create: [{ role: { connect: { name: "USER" } } }] },
      },
      include: { roles: { include: { role: true } } },
    })
    isNew = true
  } else if (user.status !== "ACTIVE") {
    return fail("حساب شما در دسترس نیست. با پشتیبانی تماس بگیرید.", 403)
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
