import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { nationalCodeSchema, shebaSchema, cardNumberSchema, toEnDigits, isValidCardNumber, isValidSheba } from "@/lib/validators"
import { ensureReferralCode } from "@/lib/referral"
import { isValidProvinceCity } from "@/constants/geo"
import { SPECIALTIES } from "@/constants/specialties"

const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(2, "نام حداقل ۲ نویسه است").max(50).optional(),
  lastName: z.string().trim().min(2, "نام خانوادگی حداقل ۲ نویسه است").max(50).optional(),
  nationalCode: nationalCodeSchema.optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  province: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  postalCode: z.string().max(10).optional().or(z.literal("")),
  cardNumber: cardNumberSchema.optional().or(z.literal("")),
  sheba: shebaSchema.optional().or(z.literal("")),
  bankAccountName: z.string().trim().max(100).optional().or(z.literal("")),
})

export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const user = await db.user.findUnique({
    where: { id: auth.user.id },
    include: {
      profile: true,
      roles: { include: { role: true } },
      referredBy: { select: { id: true, mobile: true, profile: { select: { firstName: true, lastName: true } } } },
    },
  })
  if (!user) return fail("کاربر یافت نشد.", 404)

  // REF-SYS: کد رفرال هر کاربر (کاربران قدیمی به‌صورت تنبل کد می‌گیرند)
  const referralCode = await ensureReferralCode(user.id)
  const refCount = await db.user.count({ where: { referredByUserId: user.id } })

  const p = user.profile
  return ok({
    mobile: user.mobile,
    hasPassword: !!user.passwordHash,
    roles: user.roles.map((r) => ({ name: r.role.name, title: r.role.title })),
    profile: p,
    referral: {
      code: referralCode,
      referredCount: refCount,
      referredBy: user.referredBy
        ? {
            name:
              `${user.referredBy.profile?.firstName ?? ""} ${user.referredBy.profile?.lastName ?? ""}`.trim() ||
              user.referredBy.mobile,
          }
        : null,
      // REF-SYS: دریافت پورسانت مستلزم کارت بانکی + شباست
      bankInfoComplete:
        !!p?.cardNumber && isValidCardNumber(p.cardNumber) && !!p?.sheba && isValidSheba(p.sheba),
    },
  })
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, profileUpdateSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  // اعتبارسنجی وابستگی استان/شهر (PROFILE-004/005)
  const province = data.province === "" ? null : data.province
  const city = data.city === "" ? null : data.city
  if (!isValidProvinceCity(province, city)) {
    return fail("شهر انتخاب‌شده به استان تعلق ندارد.", 422)
  }

  // یکتایی کد ملی در پروفایل‌ها (PROFILE-002)
  const nationalCode = data.nationalCode ? toEnDigits(data.nationalCode).trim() || null : undefined
  if (nationalCode) {
    const dup = await db.userProfile.findFirst({ where: { nationalCode, NOT: { userId: auth.user.id } } })
    if (dup) return fail("این کد ملی قبلاً برای حساب دیگری ثبت شده است.", 409)
  }

  let birthDate: Date | null | undefined
  if (data.birthDate === "") birthDate = null
  else if (data.birthDate) {
    const d = new Date(data.birthDate)
    if (isNaN(d.getTime())) return fail("تاریخ تولد نامعتبر است.", 422)
    birthDate = d
  }

  const update: Record<string, unknown> = {}
  if (data.firstName !== undefined) update.firstName = data.firstName
  if (data.lastName !== undefined) update.lastName = data.lastName
  if (nationalCode !== undefined) update.nationalCode = nationalCode
  if (data.gender !== undefined) update.gender = data.gender || null
  if (birthDate !== undefined) update.birthDate = birthDate
  if (province !== undefined) update.province = province
  if (city !== undefined) update.city = city
  if (data.address !== undefined) update.address = data.address || null
  if (data.postalCode !== undefined) update.postalCode = toEnDigits(data.postalCode) || null
  if (data.cardNumber !== undefined) update.cardNumber = data.cardNumber || null
  if (data.sheba !== undefined) update.sheba = data.sheba || null
  if (data.bankAccountName !== undefined) update.bankAccountName = data.bankAccountName || null

  await db.userProfile.upsert({
    where: { userId: auth.user.id },
    update,
    create: { userId: auth.user.id, ...update },
  })

  await audit(auth.user, "PROFILE_UPDATE", "USER", auth.user.id, { fields: Object.keys(update) })
  return ok({ updated: true })
}
