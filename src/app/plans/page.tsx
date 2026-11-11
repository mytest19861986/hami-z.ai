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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <p className="text-xs font-bold uppercase tracking-wider text-gold-deep">تعرفه‌ها</p>
        <h1 className="font-display mt-2 text-2xl font-extrabold sm:text-3xl">طرح‌های عضویت حامی‌کارت</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          همه طرح‌ها شامل تخفیف ویزیت پزشکان طرف قرارداد هستند. خرید طرح فقط به نام خود شما ثبت و کارت تخفیف نیز به نام شما صادر می‌شود.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
