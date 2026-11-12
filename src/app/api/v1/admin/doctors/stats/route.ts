import { NextRequest } from "next/server"
import { ok, fail, requirePermission } from "@/lib/api"
import { db } from "@/lib/db"

// آمار و بررسی ویزیت‌های یک پزشک در بازهٔ زمانی (عملیات ← آمار و بررسی · ADMIN-007)
// مرزهای بازه و گروه‌بندی روزانه بر مبنای روز تقویمی تهران است (ایران دیگر DST ندارد: UTC+3:30 ثابت)
const TEHRAN_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function tehranDayKey(d: Date): string {
  return TEHRAN_DAY.format(d) // YYYY-MM-DD
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission("doctors.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const doctorId = (sp.get("doctorId") ?? "").trim()
  if (!doctorId) return fail("شناسه پزشک الزامی است.", 422)

  const doctor = await db.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      specialty: true,
      user: { select: { profile: { select: { firstName: true, lastName: true } } } },
    },
  })
  if (!doctor) return fail("پزشک یافت نشد.", 404)

  // کلاینت تاریخ‌های شمسی را به میلادی (YYYY-MM-DD) تبدیل کرده است؛
  // بازه شامل روز پایان هم می‌شود.
  const fromStr = (sp.get("from") ?? "").trim()
  const toStr = (sp.get("to") ?? "").trim()
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(fromStr) || !dateRe.test(toStr)) {
    return fail("بازهٔ زمانی را به‌صورت صحیح انتخاب کنید.", 422)
  }
  const from = new Date(`${fromStr}T00:00:00+03:30`)
  const to = new Date(`${toStr}T23:59:59.999+03:30`)
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return fail("بازهٔ زمانی معتبر نیست.", 422)
  }

  // آمار یک پزشک در بازه محدود است؛ محاسبه در حافظه انجام می‌شود تا
  // گروه‌بندی روزانه مستقل از رفتار تاریخ‌گذرِ SQLite باشد.
  const visits = await db.visit.findMany({
    where: { doctorId, visitDate: { gte: from, lte: to } },
    select: { visitDate: true, status: true, discountAmount: true, holderId: true },
  })

  const byStatus: Record<string, number> = {}
  const byDay = new Map<string, number>()
  const holders = new Set<string>()
  let discount = 0
  for (const v of visits) {
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1
    const key = tehranDayKey(v.visitDate)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
    holders.add(v.holderId)
    discount += v.discountAmount
  }

  return ok({
    doctor: {
      id: doctor.id,
      name: `${doctor.user.profile?.firstName ?? ""} ${doctor.user.profile?.lastName ?? ""}`.trim() || "—",
      specialty: doctor.specialty,
    },
    from: fromStr,
    to: toStr,
    totals: {
      visits: visits.length,
      patients: holders.size,
      completed: byStatus.COMPLETED ?? 0,
      pending: byStatus.PENDING ?? 0,
      cancelled: byStatus.CANCELLED ?? 0,
      discount,
    },
    byStatus: Object.entries(byStatus)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    daily: [...byDay.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  })
}
