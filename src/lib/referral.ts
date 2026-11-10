// سامانهٔ کد رفرال (REF-SYS) — تولید/تضمین کد یکتا و اتصال معرف
import { db } from "@/lib/db"
import { genReferralCode } from "@/lib/codes"

/** کد رفرال کاربر را برمی‌گرداند؛ اگر ندارد (کاربران قدیمی)، یکتا تولید و ذخیره می‌کند. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, referralCode: true } })
  if (!user) throw new Error("USER_NOT_FOUND")
  if (user.referralCode) return user.referralCode
  return await assignUniqueReferralCode(user.id)
}

/** تولید کد یکتا با تلاش مجدد در برخورد (احتمال برخورد ۶ نویسه‌ای ناچیز است). */
export async function assignUniqueReferralCode(userId: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = genReferralCode()
    const clash = await db.user.findUnique({ where: { referralCode: code }, select: { id: true } })
    if (clash) continue
    await db.user.update({ where: { id: userId }, data: { referralCode: code } })
    return code
  }
  // پشتیبان قطعی یکتایی: پسوند عددی از شناسهٔ کاربر
  const fallback = (genReferralCode() + userId.replace(/\D/g, "").slice(-2)).slice(0, 8).toUpperCase()
  await db.user.update({ where: { id: userId }, data: { referralCode: fallback } })
  return fallback
}

/**
 * اعتبارسنجی و اتصال معرف هنگام ثبت‌نام:
 *  - کد باید به کاربر ACTIVE تعلق داشته باشد
 *  - کاربر تازه‌ثبت‌نام‌شده نمی‌تواند معرفِ خودش باشد (خودکار برقرار است)
 *  - ارتباط فقط یک‌بار در ثبت‌نام انجام می‌شود؛ برای کاربران موجود بی‌اثر است
 */
export async function resolveReferrerByCode(rawCode: string): Promise<{ id: string } | null> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return null
  const referrer = await db.user.findFirst({
    where: { referralCode: code, status: "ACTIVE" },
    select: { id: true },
  })
  return referrer ?? null
}
