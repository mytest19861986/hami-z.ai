"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errMessage } from "@/lib/client"
import { formatToman } from "@/lib/format"
import { faDate, daysUntil, toFaDigits } from "@/lib/jalali"
import { IdCard, ShoppingBag, Stethoscope, PlusCircle, CreditCard, Wallet, UserRoundPen, AlertCircle } from "lucide-react"
import { label } from "@/constants/labels"

interface MembershipItem {
  id: string
  planTitle: string
  holder: string
  endDate: string
  status: string
  usageLimit: number | null
  usedCount: number
  remaining: number | null
  originType: string
}

interface VisitItem {
  id: string
  holder: string
  doctorName: string
  specialty: string
  visitDate: string
  finalAmount: number
  discountAmount: number
  status: string
}

interface PurchaseItem {
  id: string
  trackingCode: string
  planTitle: string
  amount: number
  status: string
  createdAt: string
}

// USER-GATE: طرح‌های فعالِ فروش برای نمایش به کاربر تازه‌وارد
interface ShopPlanItem {
  id: string
  title: string
  description: string | null
  price: number
  durationDays: number
  discountPercent: number
  usageLimit: number | null
  features: string[]
}

export default function UserDashboard() {
  const [memberships, setMemberships] = useState<MembershipItem[] | null>(null)
  const [visits, setVisits] = useState<VisitItem[] | null>(null)
  const [purchases, setPurchases] = useState<PurchaseItem[] | null>(null)
  const [shopPlans, setShopPlans] = useState<ShopPlanItem[] | null>(null)
  const [hasNationalCode, setHasNationalCode] = useState<boolean | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api.get<MembershipItem[]>("/api/v1/user/memberships").then(setMemberships).catch((e) => setError(errMessage(e)))
    api.get<VisitItem[]>("/api/v1/user/visits").then(setVisits).catch(() => {})
    api.get<PurchaseItem[]>("/api/v1/user/purchases").then(setPurchases).catch(() => {})
    // USER-GATE: طرح‌های فعال فروش + وضعیت پروفایل (گیت پیش از خرید — خرید فقط به نام خود کاربر)
    api.get<ShopPlanItem[]>("/api/v1/public/plans").then(setShopPlans).catch(() => setShopPlans([]))
    api
      .get<{ profile: { nationalCode: string | null; firstName: string | null; lastName: string | null } | null }>("/api/v1/user/profile")
      .then((d) =>
        setHasNationalCode(
          !!(
            d.profile?.nationalCode &&
            /^\d{10}$/.test(d.profile.nationalCode) &&
            d.profile.firstName &&
            d.profile.firstName.trim().length >= 2 &&
            d.profile.lastName &&
            d.profile.lastName.trim().length >= 2
          )
        )
      )
      .catch(() => setHasNationalCode(null)) // گیت اصلی در صفحهٔ خرید هم موجود است
  }, [])

  const active = (memberships ?? []).filter((m) => m.status === "ACTIVE" && daysUntil(m.endDate) >= 0)
  const totalDiscount = (visits ?? []).reduce((s, v) => s + v.discountAmount, 0)
  // USER-GATE: کاربر تازه‌وارد (بدون طرح فعال) → فروشگاه طرح‌ها با دکمهٔ تکمیل پروفایل
  const isFreshUser = memberships !== null && active.length === 0

  return (
    <div>
      <PageHeader
        title="داشبورد کاربر"
        description="خلاصه وضعیت حساب، طرح‌های فعال و فعالیت‌های اخیر شما"
        action={
          <Button asChild>
            <Link href="/plans">
              <PlusCircle className="ml-1 h-4 w-4" />
              خرید طرح جدید
            </Link>
          </Button>
        }
      />

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="عضویت فعال" value={toFaDigits(active.length)} icon={<IdCard className="h-4 w-4" />} />
        <StatCard title="مجموع تخفیف دریافتی" value={formatToman(totalDiscount)} tone="emerald" icon={<CreditCard className="h-4 w-4" />} />
        <StatCard title="ویزیت‌های ثبت‌شده" value={toFaDigits(visits?.length ?? 0)} tone="sky" icon={<Stethoscope className="h-4 w-4" />} />
        <StatCard title="خریدهای ثبت‌شده" value={toFaDigits(purchases?.length ?? 0)} tone="violet" icon={<ShoppingBag className="h-4 w-4" />} />
      </div>

      {/* USER-GATE: کاربر تازه‌وارد — طرح‌های فعال فروش + یک دکمهٔ هدایت به تکمیل پروفایل (گیت پیش از خرید) */}
      {isFreshUser ? (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-bold">طرح‌های قابل خرید</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            طرح‌های فعال حامی‌کارت؛ برای خرید، ابتدا پروفایل خود را تکمیل کنید تا کارت تخفیف شما صادر شود.
          </p>

          {hasNationalCode === false ? (
            <Card className="mb-4 border-amber-300 bg-amber-50">
              <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">برای خرید طرح، ابتدا پروفایل خود را تکمیل کنید</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      ثبت نام، نام خانوادگی و کد ملی (۱۰ رقم) برای صدور کارت تخفیف به نام خودتان الزامی است؛ پس از تکمیل پروفایل، خرید طرح بلافاصله فعال می‌شود.
                    </p>
                  </div>
                </div>
                {/* USER-GATE: تنها مسیر خرید برای کاربر با پروفایل ناقص — تکمیل پروفایل */}
                <Button asChild size="lg" className="shrink-0">
                  <Link href="/user/profile">
                    <UserRoundPen className="ml-1 h-4 w-4" />
                    تکمیل پروفایل و خرید طرح
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!shopPlans ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
            </div>
          ) : shopPlans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <Wallet className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">در حال حاضر طرح فعالی برای فروش موجود نیست.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {shopPlans.map((plan) => (
                <Card key={plan.id} className="flex h-full flex-col">
                  <CardContent className="flex flex-1 flex-col p-5">
                    <h3 className="font-semibold">{plan.title}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{plan.description}</p>
                    <div className="font-display mt-3 text-2xl font-extrabold tabular-nums text-primary">{formatToman(plan.price)}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 font-medium text-gold-deep">{toFaDigits(plan.discountPercent)}٪ تخفیف ویزیت</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{toFaDigits(plan.durationDays)} روز اعتبار</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        {plan.usageLimit === null ? "استفاده نامحدود" : `${toFaDigits(plan.usageLimit)} مرتبه استفاده`}
                      </span>
                    </div>
                    {plan.features.length > 0 ? (
                      <ul className="mt-3 flex-1 space-y-1.5 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                        {plan.features.slice(0, 3).map((f) => (
                          <li key={f} className="flex items-center gap-1.5">
                            <span className="h-1 w-1 shrink-0 rounded-full bg-gold" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex-1" />
                    )}
                    {hasNationalCode === false ? (
                      <p className="mt-4 rounded-lg bg-muted/60 p-2.5 text-center text-xs leading-5 text-muted-foreground">
                        برای خرید این طرح، دکمهٔ «تکمیل پروفایل و خرید طرح» را بزنید.
                      </p>
                    ) : (
                      <Button asChild variant="outline" className="mt-4 w-full">
                        <Link href={`/plans/${plan.id}`}>جزئیات و خرید</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* طرح‌های فعال (USER-001/002 · PLAN-012) — فقط وقتی کاربر طرح فعال دارد */}
      {active.length > 0 ? (
        <>
          <h2 className="mb-3 mt-8 text-lg font-bold">طرح‌های فعال</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((m) => {
              const days = daysUntil(m.endDate)
              const usagePercent = m.usageLimit ? Math.min(100, Math.round((m.usedCount / m.usageLimit) * 100)) : null
              return (
                <Card key={m.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{m.planTitle}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">دارنده: {m.holder}</p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-muted/60 p-2">
                        <div className="text-xs text-muted-foreground">باقی‌مانده</div>
                        <div className="mt-0.5 font-bold">{m.usageLimit === null ? "نامحدود" : toFaDigits(m.remaining ?? 0)}</div>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <div className="text-xs text-muted-foreground">استفاده‌شده</div>
                        <div className="mt-0.5 font-bold">{toFaDigits(m.usedCount)}</div>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <div className="text-xs text-muted-foreground">اعتبار</div>
                        <div className="mt-0.5 font-bold">{toFaDigits(Math.max(0, days))} روز</div>
                      </div>
                    </div>
                    {usagePercent !== null ? (
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${usagePercent}%` }} />
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">تاریخ پایان: {faDate(m.endDate)} · منشأ: {label(m.originType)}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      ) : memberships === null ? (
        <>
          <h2 className="mb-3 mt-8 text-lg font-bold">طرح‌های فعال</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </>
      ) : null}

      {/* آخرین ویزیت‌ها (USER-005) */}
      <h2 className="mb-3 mt-8 text-lg font-bold">آخرین ویزیت‌ها</h2>
      <Card>
        <CardContent className="p-0">
          {!visits ? (
            <div className="p-4"><Skeleton className="h-20 w-full" /></div>
          ) : visits.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">ویزیتی ثبت نشده است.</p>
          ) : (
            <div className="divide-y">
              {visits.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-sm font-medium">دکتر {v.doctorName} — {v.specialty}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{v.holder} · {faDate(v.visitDate)}</div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-emerald-700">{formatToman(v.discountAmount)} تخفیف</div>
                    <div className="text-xs text-muted-foreground">پرداختی: {formatToman(v.finalAmount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
