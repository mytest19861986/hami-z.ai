import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { revokeAllUserSessions } from "@/lib/auth"
import { notify } from "@/lib/audit"
import { toEnDigits } from "@/lib/validators"
import { ROLE_NAMES } from "@/constants/permissions"

// مدیریت کاربران و نقش‌ها (ADMIN-001..005 · RBAC-005/008)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("users.view")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const q = (sp.get("q") ?? "").trim()
  const role = sp.get("role") ?? ""
  const status = sp.get("status") ?? ""
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 20

  const where = {
    ...(status ? { status } : {}),
    ...(role ? { roles: { some: { role: { name: role } } } } : {}),
    ...(q
      ? {
          OR: [
            { mobile: { contains: toEnDigits(q) } },
            { profile: { firstName: { contains: q } } },
            { profile: { lastName: { contains: q } } },
            { profile: { nationalCode: { contains: toEnDigits(q) } } },
          ],
        }
      : {}),
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        profile: true,
        roles: { include: { role: true } },
        doctor: { select: { status: true } },
        agent: { select: { status: true } },
      },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    users: users.map((u) => ({
      id: u.id,
      mobile: u.mobile,
      status: u.status,
      firstName: u.profile?.firstName,
      lastName: u.profile?.lastName,
      nationalCode: u.profile?.nationalCode,
      province: u.profile?.province,
      city: u.profile?.city,
      hasBankInfo: !!(u.profile?.cardNumber && u.profile?.sheba && u.profile?.bankAccountName),
      roles: u.roles.map((r) => ({ name: r.role.name, title: r.role.title })),
      doctorStatus: u.doctor?.status ?? null,
      agentStatus: u.agent?.status ?? null,
      createdAt: u.createdAt,
    })),
    meta: { roles: Object.entries(ROLE_NAMES).map(([name, title]) => ({ name, title })) },
  })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_status"),
    userId: z.string(),
    status: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED"]),
    reason: z.string().trim().min(3, "دلیل تغییر وضعیت الزامی است.").max(300),
  }),
  z.object({
    action: z.literal("assign_role"),
    userId: z.string(),
    role: z.enum(["USER", "DOCTOR", "AGENT", "REFERRER", "SUPPORT", "ADMIN", "SUPER_ADMIN"]),
  }),
  z.object({
    action: z.literal("revoke_role"),
    userId: z.string(),
    role: z.enum(["USER", "DOCTOR", "AGENT", "REFERRER", "SUPPORT", "ADMIN", "SUPER_ADMIN"]),
  }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission("users.manage")
  if ("response" in auth) return auth.response

  const parsed = await parseBody(req, actionSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  const target = await db.user.findUnique({ where: { id: data.userId }, include: { roles: { include: { role: true } } } })
  if (!target) return fail("کاربر یافت نشد.", 404)

  // ADMIN-020/RBAC-007: مدیر عادی نمی‌تواند نقش مدیر ارشد یا مدیر بدهد/بگیرد
  const sensitiveRoles = ["ADMIN", "SUPER_ADMIN"]
  if (auth.user.roles.includes("SUPER_ADMIN") !== true) {
    if (data.action !== "set_status" && sensitiveRoles.includes(data.role)) {
      return fail("تخصیص/سلب نقش مدیریتی فقط با اختیار مدیر ارشد ممکن است.", 403)
    }
    if (data.action === "set_status" && target.roles.some((r) => sensitiveRoles.includes(r.role.name))) {
      return fail("تغییر وضعیت حساب مدیران فقط با اختیار مدیر ارشد ممکن است.", 403)
    }
  }

  if (data.action === "set_status") {
    if (target.id === auth.user.id) return fail("تغییر وضعیت حساب خودتان مجاز نیست.", 422)
    await db.user.update({ where: { id: target.id }, data: { status: data.status } })
    // RBAC-005: قطع فوری دسترسی‌ها
    if (data.status !== "ACTIVE") await revokeAllUserSessions(target.id)
    await audit(auth.user, `USER_STATUS_${data.status}`, "USER", target.id, { reason: data.reason })
    await notify(target.id, "تغییر وضعیت حساب", `وضعیت حساب شما به «${data.status === "ACTIVE" ? "فعال" : data.status === "SUSPENDED" ? "تعلیق‌شده" : "مسدود"}» تغییر کرد. دلیل: ${data.reason}`, data.status === "ACTIVE" ? "SUCCESS" : "WARNING")
    return ok({ updated: true })
  }

  const role = await db.role.findUnique({ where: { name: data.role } })
  if (!role) return fail("نقش یافت نشد.", 404)

  if (data.action === "assign_role") {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: target.id, roleId: role.id } },
      update: {},
      create: { userId: target.id, roleId: role.id, grantedById: auth.user.id },
    })
    await audit(auth.user, "ROLE_ASSIGNED", "USER", target.id, { role: data.role })
    await notify(target.id, "افزوده‌شدن نقش جدید", `نقش «${role.title}» به حساب شما افزوده شد.`)
    return ok({ assigned: true })
  }

  // revoke_role — نقش پایه USER سلب‌شدنی نیست
  if (data.role === "USER") return fail("نقش کاربر عادی قابل سلب نیست.", 422)
  await db.userRole.deleteMany({ where: { userId: target.id, roleId: role.id } })
  await audit(auth.user, "ROLE_REVOKED", "USER", target.id, { role: data.role })
  await notify(target.id, "سلب نقش", `نقش «${role.title}» از حساب شما سلب شد.`)
  return ok({ revoked: true })
}
