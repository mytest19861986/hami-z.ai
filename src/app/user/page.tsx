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
import { formatToman, formatPercent } from "@/lib/format"
import { faDate, daysUntil, toFaDigits } from "@/lib/jalali"
import { IdCard, ShoppingBag, Stethoscope, PlusCircle, CreditCard, Wallet } from "lucide-react"
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

export default function UserDashboard() {
  const [memberships, setMemberships] = useState<MembershipItem[] | null>(null)
  const [visits, setVisits] = useState<VisitItem[] | null>(null)
  const [purchases, setPurchases] = useState<PurchaseItem[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api.get<MembershipItem[]>("/api/v1/user/memberships").then(setMemberships).catch((e) => setError(errMessage(e)))
    api.get<VisitItem[]>("/api/v1/user/visits").then(setVisits).catch(() => {})
    api.get<PurchaseItem[]>("/api/v1/user/purchases").then(setPurchases).catch(() => {})
  }, [])

  const active = (memberships ?? []).filter((m) => m.status === "ACTIVE" && daysUntil(m.endDate) >= 0)
  const totalDiscount = (visits ?? []).reduce((s, v) => s + v.discountAmount, 0)

  return (
    <div>
      <PageHeader
        title="داشبورد کاربر"
        description="خلاصه وضعیت حساب، طرح‌های فعال و فعالیت‌های اخیر شما"
        action={
          <Button asChild>
            <Link href="/plans">
              <PlusCircle className="ml-1 h-4 w-4" />
              تهیه طرح جدید
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

      {/* طرح‌های فعال (USER-001/002 · PLAN-012) */}
      <h2 className="mb-3 mt-8 text-lg font-bold">طرح‌های فعال</h2>
      {!memberships ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">هنوز طرح فعالی ندارید.</p>
            <Button asChild>
              <Link href="/plans">مشاهده طرح‌ها</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
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
      )}

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
