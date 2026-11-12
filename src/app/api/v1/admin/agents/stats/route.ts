import { NextRequest } from "next/server"
import { ok, fail, requirePermission } from "@/lib/api"
import { db } from "@/lib/db"

// عملکرد هنگام فروش یک نماینده در بازهٔ زمانی (عملیات ← مشاهده جزئیات · ADMIN-007)
// مرزهای بازه بر مبنای روز تقویمی تهران است (ایران دیگر DST ندارد: UTC+3:30 ثابت)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("agents.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const agentId = (sp.get("agentId") ?? "").trim()
  if (!agentId) return fail("شناسه نماینده الزامی است.", 422)

  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      businessName: true,
      userId: true,
      user: { select: { profile: { select: { firstName: true, lastName: true } } } },
    },
  })
  if (!agent) return fail("نماینده یافت نشد.", 404)

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

  const [sales, commissions, settlements, openSettlements] = await Promise.all([
    // مشتریان ثبت‌شدهٔ این نماینده در بازه (بدون توجه به وضعیت)
    db.saleCustomer.findMany({
      where: { agentId: agent.id, createdAt: { gte: from, lte: to } },
      select: { status: true },
    }),
    // پورسانت‌های فروش/معرفی این نماینده در بازه
    db.commission.findMany({
      where: { beneficiaryUserId: agent.userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        plan: { select: { title: true } },
        sourceSale: { select: { holder: { select: { firstName: true, lastName: true } } } },
        sourcePurchase: { select: { holder: { select: { firstName: true, lastName: true } } } },
      },
    }),
    // درخواست‌های تسویهٔ ثبت‌شده در بازه
    db.settlementRequest.findMany({
      where: { userId: agent.userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, amount: true, status: true, trackingCode: true, createdAt: true },
    }),
    // درخواست‌های تسویهٔ باز (وضعیت جاری — مستقل از بازه)
    db.settlementRequest.findMany({
      where: { userId: agent.userId, status: "PENDING" },
      select: { amount: true },
    }),
  ])

  // شمارش وضعیت فروش‌ها: پرداخت‌شده = پرداخت ثبت‌شده + نهایی‌شده
  let paid = 0
  let finalized = 0
  let returned = 0
  for (const s of sales) {
    if (s.status === "FINALIZED") {
      finalized += 1
      paid += 1
    } else if (s.status === "PAYMENT_REGISTERED") {
      paid += 1
    } else if (s.status === "RETURNED") {
      returned += 1
    }
  }

  // جمع پورسانت‌ها به تفکیک وضعیت (لغوشده در هیچ سهمی حساب نمی‌شود)
  let commissionTotal = 0
  let commissionPaid = 0
  let commissionPending = 0
  let commissionPayable = 0
  for (const c of commissions) {
    if (c.status === "CANCELLED") continue
    commissionTotal += c.amount
    if (c.status === "PAID") commissionPaid += c.amount
    else if (c.status === "PENDING") commissionPending += c.amount
    else if (c.status === "APPROVED") commissionPayable += c.amount
  }

  return ok({
    agent: {
      id: agent.id,
      name: `${agent.user.profile?.firstName ?? ""} ${agent.user.profile?.lastName ?? ""}`.trim() || "—",
      businessName: agent.businessName,
    },
    from: fromStr,
    to: toStr,
    totals: {
      customers: sales.length,
      paid,
      finalized,
      returned,
      commissionTotal,
      commissionPaid,
      commissionPending,
      commissionPayable,
      openSettlements: openSettlements.reduce((sum, r) => sum + r.amount, 0),
      openSettlementsCount: openSettlements.length,
    },
    commissions: commissions.map((c) => ({
      id: c.id,
      type: c.type,
      planTitle: c.plan.title,
      customer: c.sourceSale
        ? `${c.sourceSale.holder.firstName} ${c.sourceSale.holder.lastName}`
        : c.sourcePurchase
          ? `${c.sourcePurchase.holder.firstName} ${c.sourcePurchase.holder.lastName}`
          : null,
      amount: c.amount,
      status: c.status,
      createdAt: c.createdAt,
    })),
    settlements: settlements.map((s) => ({
      id: s.id,
      amount: s.amount,
      status: s.status,
      trackingCode: s.trackingCode,
      createdAt: s.createdAt,
    })),
  })
}
