import { NextRequest } from "next/server"
import { ok } from "@/lib/api"
import { db } from "@/lib/db"

// فهرست طرح‌های فعال برای نمایش عمومی (DOC-004: طرح غیرفعال نمایش داده نمی‌شود)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")

  if (id) {
    const plan = await db.discountPlan.findFirst({
      where: { id, isActive: true },
      select: {
        id: true, title: true, description: true, price: true, durationDays: true,
        discountPercent: true, usageLimit: true, features: true, sortOrder: true,
      },
    })
    if (!plan) return ok(null)
    return ok({ ...plan, features: plan.features ? JSON.parse(plan.features) : [] })
  }

  const plans = await db.discountPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, title: true, description: true, price: true, durationDays: true,
      discountPercent: true, usageLimit: true, features: true,
    },
  })
  return ok(plans.map((p) => ({ ...p, features: p.features ? JSON.parse(p.features) : [] })))
}
