import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { toEnDigits } from "@/lib/validators"

// احراز شرایط مراجعه دارنده طرح (DOCTOR-DASH-004 · VISIT-002 · SURF-DOCTOR)
// استعلام با کد ملی و/یا شماره همراه دارنده — حداقل یکی الزامی است
const schema = z
  .object({
    nationalCode: z
      .union([z.string(), z.undefined()])
      .transform((s) => (s ? toEnDigits(s).trim() : ""))
      .refine((s) => s === "" || /^\d{10}$/.test(s), "کد ملی ۱۰ رقمی دارنده را وارد کنید."),
    mobile: z
      .union([z.string(), z.undefined()])
      .transform((s) => (s ? toEnDigits(s).trim() : ""))
      .refine((s) => s === "" || /^09\d{9}$/.test(s), "شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود."),
  })
  .refine((d) => d.nationalCode || d.mobile, "کد ملی یا شماره همراه دارنده را وارد کنید.")

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  // فقط پزشک تأییدشده (VISIT-001)
  const doctor = await db.doctor.findUnique({ where: { userId: auth.user.id } })
  if (!doctor || doctor.status !== "APPROVED") {
    return fail("دسترسی ثبت ویزیت فقط برای پزشک تأییدشده فعال است.", 403)
  }

  const lookupByNationalCode = (nc: string) =>
    db.planHolder.findUnique({
      where: { nationalCode: nc },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { plan: { select: { id: true, title: true, discountPercent: true } } },
        },
      },
    })

  const parsed = await parseBody(req, schema)
  if ("response" in parsed) return parsed.response
  const { nationalCode, mobile } = parsed.data

  // اولویت استعلام: کد ملی دقیق، سپس موبایل دارنده (ممکن است چند دارنده باشد)
  type HolderWithMemberships = NonNullable<Awaited<ReturnType<typeof lookupByNationalCode>>>
  let holder: HolderWithMemberships | null = null
  if (nationalCode) {
    holder = await lookupByNationalCode(nationalCode)
  }
  if (!holder && mobile) {
    const holders = await db.planHolder.findMany({
      where: { mobile },
      orderBy: { createdAt: "asc" },
      take: 5,
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { plan: { select: { id: true, title: true, discountPercent: true } } },
        },
      },
    })
    holder = holders.find((h) => h.memberships.length > 0) ?? holders[0] ?? null
  }

  if (!holder) {
    return ok({ found: false, message: "دارنده‌ای با این مشخصات یافت نشد." })
  }

  const now = new Date()
  const active = holder.memberships
    .filter((m) => new Date(m.endDate) >= now)
    .map((m) => ({
      membershipId: m.id,
      planTitle: m.plan.title,
      planDiscountPercent: m.plan.discountPercent,
      endDate: m.endDate,
      usageLimit: m.usageLimit,
      usedCount: m.usedCount,
      remaining: m.usageLimit === null ? "نامحدود" : Math.max(0, m.usageLimit - m.usedCount),
      eligible: m.usageLimit === null || m.usedCount < m.usageLimit,
    }))

  // نمایش هویت حداقلی (DOCTOR-DASH-004 · SEC-001)
  return ok({
    found: true,
    holder: { firstName: holder.firstName, lastName: holder.lastName, nationalCode: holder.nationalCode },
    memberships: active,
    message: active.length === 0 ? "عضویت فعالی برای این دارنده یافت نشد." : undefined,
  })
}
