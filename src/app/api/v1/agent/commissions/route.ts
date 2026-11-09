import { NextRequest } from "next/server"
import { ok, requireUser } from "@/lib/api"
import { db } from "@/lib/db"
import { pendingCommissionsTotal } from "@/lib/wallet"

// ریز پورسانت‌های نماینده/معرف (REF-010 · AGENT-DASH-006)
export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const type = sp.get("type") ?? ""
  const status = sp.get("status") ?? ""

  const where = {
    beneficiaryUserId: auth.user.id,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  }

  const [items, sums] = await Promise.all([
    db.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        plan: { select: { title: true } },
        sourceSale: { select: { holder: { select: { firstName: true, lastName: true } } } },
        sourcePurchase: { select: { holder: { select: { firstName: true, lastName: true } } } },
      },
    }),
    db.commission.groupBy({
      by: ["status"],
      where: { beneficiaryUserId: auth.user.id },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const pendingTotal = await pendingCommissionsTotal(auth.user.id)

  return ok({
    items: items.map((c) => ({
      id: c.id,
      type: c.type,
      planTitle: c.plan.title,
      baseAmount: c.baseAmount,
      percent: c.percent,
      amount: c.amount,
      status: c.status,
      customer: c.sourceSale
        ? `${c.sourceSale.holder.firstName} ${c.sourceSale.holder.lastName}`
        : c.sourcePurchase
          ? `${c.sourcePurchase.holder.firstName} ${c.sourcePurchase.holder.lastName}`
          : null,
      createdAt: c.createdAt,
      approvedAt: c.approvedAt,
    })),
    byStatus: sums.map((s) => ({ status: s.status, total: s._sum.amount ?? 0, count: s._count })),
    pendingTotal,
  })
}
