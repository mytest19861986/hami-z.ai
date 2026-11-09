import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { toEnDigits } from "@/lib/validators"

// احراز شرایط مراجعه دارنده طرح (DOCTOR-DASH-004 · VISIT-002)
const schema = z.object({
  nationalCode: z.string().transform((s) => toEnDigits(s).trim()).refine((s) => /^\d{10}$/.test(s), "کد ملی ۱۰ رقمی دارنده را وارد کنید."),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  // فقط پزشک تأییدشده (VISIT-001)
  const doctor = await db.doctor.findUnique({ where: { userId: auth.user.id } })
  if (!doctor || doctor.status !== "APPROVED") {
    return fail("دسترسی ثبت ویزیت فقط برای پزشک تأییدشده فعال است.", 403)
  }

  const parsed = await parseBody(req, schema)
  if ("response" in parsed) return parsed.response
  const { nationalCode } = parsed.data

  const holder = await db.planHolder.findUnique({
    where: { nationalCode },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { plan: { select: { id: true, title: true, discountPercent: true } } },
      },
    },
  })

  if (!holder) {
    return ok({ found: false, message: "دارنده‌ای با این کد ملی یافت نشد." })
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
