import { db } from "@/lib/db"

// سیاست تک‌نقشی (SINGLE-ROLE): هر شماره موبایل (هر حساب کاربری) در هر لحظه فقط
// یک نقش دارد. USER نقش پایهٔ «کاربر عادی» است؛ هر نقش عملیاتی (DOCTOR، AGENT،
// REFERRER، SUPPORT، ADMIN، SUPER_ADMIN) جایگزین نقش قبلی می‌شود نه اینکه
// به آن افزوده گردد.
//
// نکته دربارهٔ User.status: جدا از نقش است (ACTIVE/SUSPENDED/…) و دست نمی‌خورد.

const BASE_ROLE = "USER"

/**
 * جایگزینی نقش کاربر با نقش جدید (تک‌نقشی).
 * - نقش جدید همان نقش فعلی باشد → بدون تغییر.
 * - در غیر این صورت: همهٔ نقش‌های قبلی حذف و فقط نقش جدید اعطا می‌شود.
 *   (اگر نقش جدید خودِ USER باشد یعنی بازگشت به «کاربر عادی»)
 * @param grantedById شناسهٔ اعطاکننده (اختیاری — برای ثبت در audit trail)
 * @returns نقش نهایی کاربر
 */
export async function setUserRole(userId: string, roleName: string, grantedById?: string): Promise<string> {
  const role = await db.role.findUnique({ where: { name: roleName } })
  if (!role) throw new Error(`ROLE_NOT_FOUND:${roleName}`)

  const current = await db.userRole.findMany({
    where: { userId },
    select: { roleId: true },
  })

  if (current.length === 1 && current[0].roleId === role.id) return roleName

  // جایگزینی اتمیک: حذف نقش‌های قبلی + اعطای نقش جدید
  await db.$transaction([
    db.userRole.deleteMany({ where: { userId } }),
    db.userRole.create({ data: { userId, roleId: role.id, ...(grantedById ? { grantedById } : {}) } }),
  ])
  return roleName
}

/** نقش‌های فعلی کاربر — در حالت تک‌نقشی حداکثر یک عضو دارد */
export async function getUserRoles(userId: string): Promise<string[]> {
  const rows = await db.userRole.findMany({
    where: { userId },
    select: { role: { select: { name: true } } },
  })
  return rows.map((r) => r.role.name)
}
