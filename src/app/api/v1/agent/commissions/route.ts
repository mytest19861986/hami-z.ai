import { NextRequest } from "next/server"
import { ok, fail, requireUser } from "@/lib/api"
import { db } from "@/lib/db"
import { pendingCommissionsTotal } from "@/lib/wallet"

// ریز پورسانت‌های نماینده/معرف (REF-010 · AGENT-DASH-006)
// فیلترها: type / status / بازه from-to (میلادی ISO با مرزهای روز +03:30)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const type = sp.get("type") ?? ""
  const status = sp.get("status") ?? ""
  const fromStr = (sp.get("from") ?? "").trim()
  const toStr = (sp.get("to") ?? "").trim()

  // اعتبارسنجی بازه (در صورت وجود): قالب ISO + از ≤ تا
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

  const where = {
    beneficiaryUserId: auth.user.id,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(from && to ? { createdAt: { gte: from, lte: to } } : {}),
  }

  // کارت‌های وضعیت هم با اعمال فیلترها جمع می‌شوند (بازه/نوع/وضعیت)
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
      where,
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
