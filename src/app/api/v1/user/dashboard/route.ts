import { NextRequest } from "next/server"
import { ok, fail, requireUser } from "@/lib/api"
import { db } from "@/lib/db"

// داشبورد کاربر با فیلتر بازه تاریخ شمسی (USER-001 · UX-002)
// خروجی: آمار بازه (تخفیف، ویزیت، خرید) + آخرین ویزیت‌های همان بازه
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const fromStr = (sp.get("from") ?? "").trim()
  const toStr = (sp.get("to") ?? "").trim()

  // بازه اختیاری است: بدون از/تا، کل تاریخچه شمرده می‌شود
  let from: Date | null = null
  let to: Date | null = null
  if (fromStr || toStr) {
    if (!DATE_RE.test(fromStr) || !DATE_RE.test(toStr)) {
      return fail("بازه تاریخ نامعتبر است. هر دو تاریخ «از» و «تا» لازم است (YYYY-MM-DD).", 422)
    }
    from = new Date(`${fromStr}T00:00:00+03:30`)
    to = new Date(`${toStr}T23:59:59.999+03:30`)
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return fail("بازه تاریخ نامعتبر است: «از» باید قبل از «تا» باشد.", 422)
    }
  }

  // عضویت‌های مرتبط با کاربر (خریدار یا سازندهٔ دارنده) برای محدودهٔ ویزیت‌ها
  const membershipWhere = {
    OR: [{ buyerUserId: auth.user.id }, { holder: { createdByUserId: auth.user.id } }],
  }
  const visitWhere = {
    membership: membershipWhere,
    ...(from && to ? { visitDate: { gte: from, lte: to } } : {}),
  }
  const purchaseWhere = {
    buyerUserId: auth.user.id,
    ...(from && to ? { createdAt: { gte: from, lte: to } } : {}),
  }

  const [visits, purchases] = await Promise.all([
    db.visit.findMany({
      where: visitWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        doctor: {
          select: {
            specialty: true,
            user: { select: { profile: { select: { firstName: true, lastName: true } } } },
          },
        },
        holder: { select: { firstName: true, lastName: true } },
      },
    }),
    db.purchase.findMany({
      where: purchaseWhere,
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ])

  const totalDiscount = visits.reduce((s, v) => s + v.discountAmount, 0)

  return ok({
    from: fromStr || null,
    to: toStr || null,
    totals: {
      visits: visits.length,
      totalDiscount,
      purchases: purchases.length,
    },
    visits: visits.slice(0, 5).map((v) => ({
      id: v.id,
      holder: `${v.holder.firstName} ${v.holder.lastName}`,
      doctorName: `${v.doctor.user.profile?.firstName ?? ""} ${v.doctor.user.profile?.lastName ?? ""}`.trim(),
      specialty: v.doctor.specialty,
      visitDate: v.visitDate,
      discountAmount: v.discountAmount,
      finalAmount: v.finalAmount,
    })),
  })
}
