import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { toEnDigits } from "@/lib/validators"
import { discountAmount } from "@/lib/format"
import { getSetting } from "@/lib/settings"

// ثبت ویزیت (VISIT-001..013 · AC-07 · AC-08 · BR-08) — مصرف اتمیک سهمیه
// مبلغ ویزیت اختیاری است: ارسال نشود یا 0 باشد → ویزیت بدون مبلغ و بدون تخفیف ریالی ثبت می‌شود
const createSchema = z.object({
  membershipId: z.string().min(1, "عضویت را انتخاب کنید."),
  totalAmount: z.number({ message: "مبلغ ویزیت را وارد کنید." }).int("مبلغ باید عدد صحیح باشد.").min(0, "مبلغ ویزیت نامعتبر است.").max(1_000_000_000).optional().default(0),
  note: z.string().trim().max(500, "یادداشت حداکثر ۵۰۰ نویسه است.").optional().or(z.literal("")),
})

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const doctor = await db.doctor.findUnique({ where: { userId: auth.user.id } })
  if (!doctor) return fail("پروفایل پزشکی یافت نشد.", 404)

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 20

  const where = { doctorId: doctor.id, ...(status ? { status } : {}) }
  const [total, visits] = await Promise.all([
    db.visit.count({ where }),
    db.visit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        holder: { select: { firstName: true, lastName: true } },
        membership: { select: { plan: { select: { title: true } } } },
      },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    visits: visits.map((v) => ({
      id: v.id,
      holder: `${v.holder.firstName} ${v.holder.lastName}`,
      planTitle: v.membership.plan.title,
      visitDate: v.visitDate,
      totalAmount: v.totalAmount,
      discountPercent: v.discountPercent,
      discountBase: v.discountBase,
      discountAmount: v.discountAmount,
      finalAmount: v.finalAmount,
      status: v.status,
      note: v.note,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const doctor = await db.doctor.findUnique({ where: { userId: auth.user.id } })
  if (!doctor || doctor.status !== "APPROVED") {
    return fail("دسترسی ثبت ویزیت فقط برای پزشک تأییدشده فعال است.", 403)
  }

  const parsed = await parseBody(req, createSchema)
  if ("response" in parsed) return parsed.response
  const { membershipId, totalAmount, note } = parsed.data

  try {
    const result = await db.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { id: membershipId },
        include: { plan: true, holder: true },
      })
      if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND")

      const now = new Date()
      // اعتبارسنجی کامل پیش از مصرف (VISIT-002 · BR-07)
      if (membership.status !== "ACTIVE") throw new Error("MEMBERSHIP_NOT_ACTIVE")
      if (new Date(membership.endDate) < now) throw new Error("MEMBERSHIP_EXPIRED")
      if (membership.usageLimit !== null && membership.usedCount >= membership.usageLimit) {
        throw new Error("QUOTA_EXHAUSTED")
      }

      // مبنای تخفیف بر اساس تنظیم مصوب OPEN-02 (DISCOUNT_PRECEDENCE):
      // DOCTOR (پیش‌فرض) = درصد اختصاصی پزشک در صورت وجود مقدم است؛ PLAN = درصد طرح همیشه مقدم
      // مبلغ صفر (اختیاری‌بودن مبلغ) → تخفیف ریالی ندارد ولی درصد پایه ثبت می‌شود
      const precedence = (await getSetting("DISCOUNT_PRECEDENCE")) || "DOCTOR"
      const planPercent = membership.plan.discountPercent
      const doctorPercent = doctor.discountPercent
      let percent: number
      let base: "PLAN" | "DOCTOR"
      if (precedence === "PLAN") {
        percent = planPercent
        base = "PLAN"
      } else {
        percent = doctorPercent ?? planPercent
        base = doctorPercent !== null && doctorPercent !== undefined ? "DOCTOR" : "PLAN"
      }
      const disc = totalAmount > 0 ? discountAmount(totalAmount, percent) : 0
      const final = totalAmount - disc

      // مصرف اتمیک سهمیه + ثبت ویزیت در یک تراکنش (VISIT-005/006 · SEC-007)
      const updated = await tx.membership.updateMany({
        where: {
          id: membership.id,
          status: "ACTIVE",
          endDate: { gte: now },
          ...(membership.usageLimit !== null ? { usedCount: { lt: membership.usageLimit } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      })
      if (updated.count === 0) throw new Error("QUOTA_RACE")

      const visit = await tx.visit.create({
        data: {
          membershipId: membership.id,
          holderId: membership.holderId,
          doctorId: doctor.id,
          recordedById: auth.user.id,
          visitDate: now, // VISIT-004: ثبت تاریخ گذشته/حال؛ تاریخ آینده ممکن نیست
          totalAmount,
          discountPercent: percent,
          discountBase: base,
          discountAmount: disc,
          finalAmount: final,
          status: "COMPLETED",
          quotaConsumedAt: now,
          note: note || null,
        },
      })

      return { visit, holderName: `${membership.holder.firstName} ${membership.holder.lastName}` }
    })

    return ok({
      visit: {
        id: result.visit.id,
        holder: result.holderName,
        totalAmount: result.visit.totalAmount,
        discountPercent: result.visit.discountPercent,
        discountBase: result.visit.discountBase,
        discountAmount: result.visit.discountAmount,
        finalAmount: result.visit.finalAmount,
        visitDate: result.visit.visitDate,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const map: Record<string, string> = {
      MEMBERSHIP_NOT_FOUND: "عضویت یافت نشد.",
      MEMBERSHIP_NOT_ACTIVE: "عضویت فعال نیست.",
      MEMBERSHIP_EXPIRED: "اعتبار عضویت به پایان رسیده است.",
      QUOTA_EXHAUSTED: "سهمیه این عضویت تکمیل شده است.",
      QUOTA_RACE: "سهمیه در همین لحظه مصرف شد؛ ثبت تکراری انجام نشد.",
    }
    if (msg in map) return fail(map[msg], 409)
    console.error("[VISIT_CREATE_FAIL]", e)
    return fail("خطا در ثبت ویزیت.", 500)
  }
}
