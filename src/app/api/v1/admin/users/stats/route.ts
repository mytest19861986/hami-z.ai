import { NextRequest } from "next/server"
import { ok, fail, requirePermission } from "@/lib/api"
import { db } from "@/lib/db"

// جزئیات و گزارش فعالیت یک کاربر در بازهٔ زمانی (عملیات ← مشاهده جزئیات · ADMIN-002)
// مرزهای بازه بر مبنای روز تقویمی تهران است (ایران دیگر DST ندارد: UTC+3:30 ثابت)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("users.view")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const userId = (sp.get("userId") ?? "").trim()
  if (!userId) return fail("شناسه کاربر الزامی است.", 422)

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      mobile: true,
      status: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  })
  if (!user) return fail("کاربر یافت نشد.", 404)

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

  // اشتراک‌های متعلق به این کاربر: خرید مستقیم خود کاربر
  const membershipFilter = {
    OR: [{ buyerUserId: user.id }, { purchase: { buyerUserId: user.id } }],
  }

  const [purchases, commissions, activeMemberships, visits, referrals, wallet] = await Promise.all([
    // خریدهای ثبت‌شدهٔ کاربر در بازه
    db.purchase.findMany({
      where: { buyerUserId: user.id, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        plan: { select: { title: true } },
        holder: { select: { firstName: true, lastName: true } },
      },
    }),
    // پورسانت‌های فروش/معرفی این کاربر در بازه
    db.commission.findMany({
      where: { beneficiaryUserId: user.id, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        plan: { select: { title: true } },
        sourceSale: { select: { holder: { select: { firstName: true, lastName: true } } } },
        sourcePurchase: { select: { holder: { select: { firstName: true, lastName: true } } } },
      },
    }),
    // اشتراک‌های فعال (وضعیت جاری — مستقل از بازه)
    db.membership.count({ where: { ...membershipFilter, status: "ACTIVE" } }),
    // ویزیت‌های تکمیل‌شده روی اشتراک‌های کاربر در بازه
    db.visit.findMany({
      where: {
        status: "COMPLETED",
        visitDate: { gte: from, lte: to },
        membership: membershipFilter,
      },
      select: { discountAmount: true },
    }),
    // کاربرانی که با کد معرفی این کاربر ثبت‌نام کرده‌اند (در بازه)
    db.user.count({ where: { referredByUserId: user.id, createdAt: { gte: from, lte: to } } }),
    // موجودی کیف پول (وضعیت جاری — مستقل از بازه)
    db.wallet.findUnique({
      where: { userId: user.id },
      select: { withdrawableBalance: true, heldBalance: true },
    }),
  ])

  let purchasesSuccess = 0
  let purchasesPending = 0
  let totalPaid = 0
  for (const p of purchases) {
    if (p.status === "SUCCESS") {
      purchasesSuccess += 1
      totalPaid += p.amount
    } else if (p.status === "PENDING") {
      purchasesPending += 1
    }
  }

  // جمع پورسانت‌ها (لغوشده حساب نمی‌شود)
  let commissionTotal = 0
  for (const c of commissions) {
    if (c.status === "CANCELLED") continue
    commissionTotal += c.amount
  }

  return ok({
    user: {
      id: user.id,
      name: `${user.profile?.firstName ?? ""} ${user.profile?.lastName ?? ""}`.trim() || "—",
      mobile: user.mobile,
      status: user.status,
    },
    from: fromStr,
    to: toStr,
    totals: {
      purchases: purchases.length,
      purchasesSuccess,
      purchasesPending,
      totalPaid,
      activeMemberships,
      visits: visits.length,
      discountReceived: visits.reduce((sum, v) => sum + v.discountAmount, 0),
      referrals,
      commissionTotal,
      walletWithdrawable: wallet?.withdrawableBalance ?? 0,
      walletHeld: wallet?.heldBalance ?? 0,
    },
    purchases: purchases.map((p) => ({
      id: p.id,
      planTitle: p.plan.title,
      holder: `${p.holder.firstName} ${p.holder.lastName}`,
      amount: p.amount,
      status: p.status,
      trackingCode: p.trackingCode,
      createdAt: p.createdAt,
    })),
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
  })
}
