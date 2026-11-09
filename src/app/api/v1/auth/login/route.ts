import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, parseBody, clientIp } from "@/lib/api"
import { createSession } from "@/lib/auth"
import { verifyPassword } from "@/lib/password"
import { roleHome } from "@/constants/permissions"
import { db } from "@/lib/db"
import { mobileSchema } from "@/lib/validators"

// ورود با رمز عبور — فقط برای حساب‌هایی که رمز دارند (AUTH-005..008)
export async function POST(req: NextRequest) {
  const parsed = await parseBody(
    req,
    z.object({ mobile: mobileSchema, password: z.string().min(6, "رمز عبور حداقل ۶ نویسه است") })
  )
  if ("response" in parsed) return parsed.response
  const { mobile, password } = parsed.data

  const ip = clientIp(req)
  const ua = req.headers.get("user-agent")

  const user = await db.user.findUnique({ where: { mobile }, include: { roles: { include: { role: true } } } })

  // پیام یکسان برای هر دو حالت (AUTH-008)
  const genericError = "شماره موبایل یا رمز عبور نادرست است."
  if (!user || !user.passwordHash) {
    await db.loginLog.create({ data: { userId: user?.id, mobile, method: "PASSWORD", success: false, failReason: "NOT_FOUND_OR_NO_PASSWORD", ip, userAgent: ua } })
    return fail(genericError, 401)
  }
  if (user.status !== "ACTIVE") {
    await db.loginLog.create({ data: { userId: user.id, mobile, method: "PASSWORD", success: false, failReason: `STATUS_${user.status}`, ip, userAgent: ua } })
    return fail(genericError, 401)
  }
  if (!verifyPassword(password, user.passwordHash)) {
    await db.loginLog.create({ data: { userId: user.id, mobile, method: "PASSWORD", success: false, failReason: "WRONG_PASSWORD", ip, userAgent: ua } })
    return fail(genericError, 401)
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await db.loginLog.create({ data: { userId: user.id, mobile, method: "PASSWORD", success: true, ip, userAgent: ua } })
  await createSession(user.id, ip, ua)

  const roles = user.roles.map((r) => r.role.name)
  return ok({ roles, redirect: roleHome(roles), mobile: user.mobile })
}
