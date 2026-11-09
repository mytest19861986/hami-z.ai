import { ok, requirePermission } from "@/lib/api"
import { db } from "@/lib/db"

// گزارش‌های مدیریتی (REPORT-001..011 · AC-18) — تفکیک شفاف وضعیت‌ها
export async function GET() {
  const auth = await requirePermission("reports.view")
  if ("response" in auth) return auth.response

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    membersReport, salesReport, visitsReport, commissionsReport,
    settlementsReport, purchasesAgg, salesFunnel, topAgents, growth,
  ] = await Promise.all([
    // REPORT-001: اعضا و عضویت‌ها
    db.membership.groupBy({
      by: ["status"],
      _count: true,
      where: { OR: [{ status: "ACTIVE" }, { status: "CANCELLED" }] },
    }).then(async (rows) => {
      const expired = await db.membership.count({ where: { status: "ACTIVE", endDate: { lt: now } } })
      const active = await db.membership.count({ where: { status: "ACTIVE", endDate: { gte: now } } })
      const holders = await db.planHolder.count()
      return { active, expired, cancelled: rows.find((r) => r.status === "CANCELLED")?._count ?? 0, holders }
    }),
    // REPORT-002: فروش به تفکیک طرح
    db.saleCustomer.groupBy({
      by: ["planId", "status"],
      _count: true,
      _sum: { paymentAmount: true },
    }).then(async (rows) => {
      const plans = await db.discountPlan.findMany({ select: { id: true, title: true } })
      const map = new Map<string, { planTitle: string; finalized: number; open: number; returned: number; rejected: number; amount: number }>()
      for (const r of rows) {
        const p = plans.find((x) => x.id === r.planId)
        const key = r.planId
        if (!map.has(key)) map.set(key, { planTitle: p?.title ?? "—", finalized: 0, open: 0, returned: 0, rejected: 0, amount: 0 })
        const e = map.get(key)!
        if (r.status === "FINALIZED") { e.finalized += r._count; e.amount += r._sum.paymentAmount ?? 0 }
        else if (r.status === "RETURNED") e.returned += r._count
        else if (r.status === "REJECTED") e.rejected += r._count
        else e.open += r._count
      }
      return Array.from(map.values())
    }),
    // REPORT-004: ویزیت و تخفیف
    db.visit.aggregate({ _count: true, _sum: { discountAmount: true, finalAmount: true, totalAmount: true } })
      .then(async (agg) => {
        const byDoctor = await db.visit.groupBy({
          by: ["doctorId"],
          _count: { _all: true },
          _sum: { discountAmount: true },
        }).then(async (rows) => {
          const doctors = await db.doctor.findMany({
            where: { id: { in: rows.map((r) => r.doctorId) } },
            include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
          })
          return rows
            .map((r) => {
              const d = doctors.find((x) => x.id === r.doctorId)
              return { doctor: `${d?.user.profile?.firstName ?? ""} ${d?.user.profile?.lastName ?? ""}`.trim(), visits: r._count._all, discount: r._sum.discountAmount ?? 0 }
            })
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 10)
        })
        return { total: agg._count, totalDiscount: agg._sum.discountAmount ?? 0, totalFinal: agg._sum.finalAmount ?? 0, byDoctor }
      }),
    // REPORT-005: پورسانت‌ها
    db.commission.groupBy({ by: ["type", "status"], _count: true, _sum: { amount: true } }),
    // REPORT-006: تسویه‌ها
    db.settlementRequest.groupBy({
      by: ["status"],
      _count: true,
      _sum: { amount: true },
    }).then(async (rows) => {
      const wallets = await db.wallet.aggregate({ _sum: { withdrawableBalance: true, heldBalance: true } })
      return { byStatus: rows, walletsTotalWithdrawable: wallets._sum.withdrawableBalance ?? 0, walletsTotalHeld: wallets._sum.heldBalance ?? 0 }
    }),
    // خریدهای مستقیم (REPORT-011: تفکیک خرید/فروش)
    db.purchase.groupBy({ by: ["status"], _count: true, _sum: { amount: true } }),
    // REPORT-003: قیف فروش
    db.saleCustomer.groupBy({ by: ["status"], _count: true }),
    // نمایندگان برتر
    db.saleCustomer.groupBy({
      by: ["agentId"],
      _count: true,
      where: { status: "FINALIZED" },
    }).then(async (rows) => {
      const agents = await db.agent.findMany({
        where: { id: { in: rows.map((r) => r.agentId) } },
        include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
      })
      return rows
        .map((r) => {
          const a = agents.find((x) => x.id === r.agentId)
          return { agent: `${a?.user.profile?.firstName ?? ""} ${a?.user.profile?.lastName ?? ""}`.trim() || a?.businessName || "—", finalizedSales: r._count }
        })
        .sort((x, y) => y.finalizedSales - x.finalizedSales)
        .slice(0, 10)
    }),
    // REPORT-010: روند ماه جاری
    Promise.all([
      db.user.count({ where: { createdAt: { gte: monthStart } } }),
      db.purchase.count({ where: { createdAt: { gte: monthStart } } }),
      db.saleCustomer.count({ where: { createdAt: { gte: monthStart } } }),
      db.visit.count({ where: { createdAt: { gte: monthStart } } }),
      db.doctor.count({ where: { createdAt: { gte: monthStart } } }),
    ]).then(([users, purchases, sales, visits, doctors]) => ({ users, purchases, sales, visits, doctors })),
  ])

  return ok({
    members: membersReport,
    sales: salesReport,
    visits: visitsReport,
    commissions: commissionsReport.map((c) => ({ type: c.type, status: c.status, count: c._count, total: c._sum.amount ?? 0 })),
    settlements: settlementsReport,
    purchases: purchasesAgg.map((p) => ({ status: p.status, count: p._count, total: p._sum.amount ?? 0 })),
    salesFunnel: salesFunnel.map((f) => ({ status: f.status, count: f._count })),
    topAgents,
    growthThisMonth: growth,
  })
}
