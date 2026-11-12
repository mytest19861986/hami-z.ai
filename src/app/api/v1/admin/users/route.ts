import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { revokeAllUserSessions } from "@/lib/auth"
import { notify } from "@/lib/audit"
import { isValidNationalCode, isValidCardNumber, isValidSheba, normalizeSheba, toEnDigits } from "@/lib/validators"
import { isValidProvinceCity } from "@/constants/geo"
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
      address: u.profile?.address,
      postalCode: u.profile?.postalCode,
      cardNumber: u.profile?.cardNumber,
      sheba: u.profile?.sheba,
      bankAccountName: u.profile?.bankAccountName,
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
  // مشاهده / ویرایش اطلاعات — دکمهٔ «عملیات» در صفحهٔ کاربران ادمین
  z.object({
    action: z.literal("update_profile"),
    userId: z.string(),
    firstName: z.string().trim().max(60, "نام حداکثر ۶۰ نویسه است.").optional(),
    lastName: z.string().trim().max(60, "نام خانوادگی حداکثر ۶۰ نویسه است.").optional(),
    nationalCode: z.string().trim().max(15).optional(),
    province: z.string().trim().max(60).optional(),
    city: z.string().trim().max(60).optional(),
    address: z.string().trim().max(300, "آدرس حداکثر ۳۰۰ نویسه است.").optional(),
    postalCode: z.string().trim().max(15).optional(),
    cardNumber: z.string().trim().max(25).optional(),
    sheba: z.string().trim().max(30).optional(),
    bankAccountName: z.string().trim().max(120, "نام صاحب حساب حداکثر ۱۲۰ نویسه است.").optional(),
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
    if ((data.action === "assign_role" || data.action === "revoke_role") && sensitiveRoles.includes(data.role)) {
      return fail("تخصیص/سلب نقش مدیریتی فقط با اختیار مدیر ارشد ممکن است.", 403)
    }
    if (
      (data.action === "set_status" || data.action === "update_profile") &&
      target.roles.some((r) => sensitiveRoles.includes(r.role.name))
    ) {
      return fail("تغییر وضعیت یا اطلاعات حساب مدیران فقط با اختیار مدیر ارشد ممکن است.", 403)
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

  // update_profile — مشاهده / ویرایش اطلاعات (دکمهٔ «عملیات»)
  if (data.action === "update_profile") {
    if (!data.firstName?.trim() || !data.lastName?.trim()) {
      return fail("نام و نام خانوادگی الزامی است.", 422)
    }
    const nationalCode = toEnDigits(data.nationalCode ?? "").trim()
    if (nationalCode && !isValidNationalCode(nationalCode)) {
      return fail("کد ملی باید دقیقاً ۱۰ رقم باشد.", 422)
    }
    const postalCode = toEnDigits(data.postalCode ?? "").trim()
    if (postalCode && !/^\d{10}$/.test(postalCode)) {
      return fail("کد پستی باید دقیقاً ۱۰ رقم باشد.", 422)
    }
    const cardNumber = toEnDigits(data.cardNumber ?? "").replace(/[\s-]/g, "")
    if (cardNumber && !isValidCardNumber(cardNumber)) {
      return fail("شماره کارت باید دقیقاً ۱۶ رقم باشد.", 422)
    }
    const shebaRaw = (data.sheba ?? "").trim()
    const sheba = shebaRaw ? normalizeSheba(shebaRaw) : ""
    if (sheba && !isValidSheba(sheba)) {
      return fail("شماره شبا معتبر نیست (۲۴ رقم، با یا بدون IR).", 422)
    }
    if (!isValidProvinceCity(data.province ?? null, data.city ?? null)) {
      return fail("استان یا شهر انتخاب‌شده معتبر نیست.", 422)
    }

    // کد ملی یکتا است؛ تکرار برای کاربر دیگر مجاز نیست
    if (nationalCode) {
      const dup = await db.userProfile.findFirst({
        where: { nationalCode, userId: { not: target.id } },
        select: { id: true },
      })
      if (dup) return fail("این کد ملی قبلاً برای کاربر دیگری ثبت شده است.", 422)
    }

    const profileData = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      nationalCode: nationalCode || null,
      province: data.province || null,
      city: data.city || null,
      address: data.address?.trim() || null,
      postalCode: postalCode || null,
      cardNumber: cardNumber || null,
      sheba: sheba || null,
      bankAccountName: data.bankAccountName?.trim() || null,
    }
    // پروفایل ممکن است هنوز ساخته نشده باشد
    const profile = await db.userProfile.findUnique({ where: { userId: target.id } })
    if (profile) {
      await db.userProfile.update({ where: { userId: target.id }, data: profileData })
    } else {
      await db.userProfile.create({ data: { userId: target.id, ...profileData } })
    }

    await audit(auth.user, "USER_PROFILE_UPDATE", "USER", target.id, {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      nationalCode: profileData.nationalCode,
      province: profileData.province,
      city: profileData.city,
    })
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
