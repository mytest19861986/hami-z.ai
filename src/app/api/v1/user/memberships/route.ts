import { ok, requireUser } from "@/lib/api"
import { db } from "@/lib/db"

// عضویت‌های مرتبط با کاربر (USER-002 · PLAN-012/013)
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const memberships = await db.membership.findMany({
    where: {
      OR: [
        { buyerUserId: auth.user.id },
        { holder: { createdByUserId: auth.user.id } },
      ],
    },
    include: {
      plan: { select: { id: true, title: true, discountPercent: true, usageLimit: true } },
      holder: { select: { id: true, firstName: true, lastName: true, nationalCode: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const now = new Date()
  const data = memberships.map((m) => {
    const expired = m.status === "ACTIVE" && new Date(m.endDate) < now
    return {
      id: m.id,
      planTitle: m.plan.title,
      planDiscountPercent: m.plan.discountPercent,
      holder: `${m.holder.firstName} ${m.holder.lastName}`,
      holderNationalCode: m.holder.nationalCode,
      originType: m.originType,
      startDate: m.startDate,
      endDate: m.endDate,
      status: expired ? "EXPIRED" : m.status,
      usageLimit: m.usageLimit,
      usedCount: m.usedCount,
      remaining: m.usageLimit === null ? null : Math.max(0, m.usageLimit - m.usedCount),
      cardSerial: m.cardSerial, // SURF-USER: سریال کارت مجازی
    }
  })

  return ok(data)
}
