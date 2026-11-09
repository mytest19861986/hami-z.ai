import { db } from "@/lib/db"
import { PublicHeader, PublicFooter } from "@/components/shared/public-chrome"
import { PlanCard } from "./plan-card"

export const dynamic = "force-dynamic"

export const metadata = { title: "طرح‌های عضویت" }

export default async function PlansPage() {
  const plans = await db.discountPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">طرح‌های عضویت حامی‌کارت</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          همه طرح‌ها شامل تخفیف ویزیت پزشکان طرف قرارداد هستند. خریدار و دارنده کارت می‌توانند اشخاص متفاوتی باشند.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={{
                id: p.id,
                title: p.title,
                description: p.description,
                price: p.price,
                durationDays: p.durationDays,
                discountPercent: p.discountPercent,
                usageLimit: p.usageLimit,
                features: p.features ? JSON.parse(p.features) : [],
              }}
            />
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
