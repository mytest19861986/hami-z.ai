"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { toFaDigits } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { COMMISSION_TYPE_LABELS } from "@/constants/labels"

interface ReportsData {
  members: { active: number; expired: number; cancelled: number; holders: number }
  sales: { planTitle: string; finalized: number; open: number; returned: number; rejected: number; amount: number }[]
  visits: { total: number; totalDiscount: number; totalFinal: number; byDoctor: { doctor: string; visits: number; discount: number }[] }
  commissions: { type: string; status: string; count: number; total: number }[]
  settlements: { byStatus: { status: string; _count: number; _sum: { amount: number | null } }[]; walletsTotalWithdrawable: number; walletsTotalHeld: number }
  purchases: { status: string; count: number; total: number }[]
  salesFunnel: { status: string; count: number }[]
  topAgents: { agent: string; finalizedSales: number }[]
  growthThisMonth: { users: number; purchases: number; sales: number; visits: number; doctors: number }
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null)

  useEffect(() => {
    api.get<ReportsData>("/api/v1/admin/reports").then(setData).catch((e) => toast({ title: "خطا", description: errMessage(e), variant: "destructive" }))
  }, [])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="گزارش‌های مدیریتی" description="گزارش‌های تطبیق‌پذیر با تفکیک شفاف وضعیت‌ها (REPORT-001..011 · AC-18)" />

      <h2 className="mb-3 text-lg font-bold">اعضا و عضویت‌ها</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="عضویت فعال" value={toFaDigits(data.members.active)} tone="emerald" />
        <StatCard title="منقضی‌شده" value={toFaDigits(data.members.expired)} tone="slate" />
        <StatCard title="لغوشده" value={toFaDigits(data.members.cancelled)} tone="rose" />
        <StatCard title="دارندگان ثبت‌شده" value={toFaDigits(data.members.holders)} tone="sky" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">خرید مستقیم (به تفکیک وضعیت)</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.purchases.map((p) => (
          <StatCard key={p.status} title={label(p.status)} value={toFaDigits(p.count)} hint={formatToman(p.total)} tone={p.status === "SUCCESS" ? "emerald" : p.status === "PENDING" ? "amber" : "slate"} />
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">قیف فروش نمایندگان (REPORT-003)</h2>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.salesFunnel.map((f) => (
              <div key={f.status} className="flex items-center justify-between p-3 text-sm">
                <span className="text-muted-foreground">{label(f.status)}</span>
                <span className="font-bold">{toFaDigits(f.count)} پرونده</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-bold">فروش به تفکیک طرح (REPORT-002)</h2>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.sales.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">فروشی ثبت نشده است.</p>
            ) : (
              data.sales.map((s) => (
                <div key={s.planTitle} className="grid grid-cols-2 gap-2 p-3 text-sm sm:grid-cols-6">
                  <span className="font-semibold sm:col-span-2">{s.planTitle}</span>
                  <span className="text-muted-foreground">نهایی: <b className="text-foreground">{toFaDigits(s.finalized)}</b></span>
                  <span className="text-muted-foreground">در جریان: <b className="text-foreground">{toFaDigits(s.open)}</b></span>
                  <span className="text-muted-foreground">مرجوع/رد: <b className="text-foreground">{toFaDigits(s.returned + s.rejected)}</b></span>
                  <span className="text-muted-foreground">مبلغ پرداخت: <b className="text-foreground">{formatToman(s.amount)}</b></span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-bold">ویزیت و تخفیف (REPORT-004)</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="کل ویزیت‌ها" value={toFaDigits(data.visits.total)} />
        <StatCard title="مجموع تخفیف" value={formatToman(data.visits.totalDiscount)} tone="emerald" />
        <StatCard title="مجموع پرداختی" value={formatToman(data.visits.totalFinal)} tone="sky" />
      </div>
      {data.visits.byDoctor.length > 0 ? (
        <Card className="mt-4">
          <CardContent className="p-0">
            <div className="divide-y">
              {data.visits.byDoctor.map((d) => (
                <div key={d.doctor} className="flex items-center justify-between p-3 text-sm">
                  <span>دکتر {d.doctor}</span>
                  <span className="text-muted-foreground">{toFaDigits(d.visits)} ویزیت · <b className="text-foreground">{formatToman(d.discount)}</b> تخفیف</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <h2 className="mb-3 mt-8 text-lg font-bold">پورسانت‌ها (REPORT-005)</h2>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.commissions.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 text-sm">
                <span className="text-muted-foreground">
                  {COMMISSION_TYPE_LABELS[c.type] ?? c.type} — {label(c.status)} ({toFaDigits(c.count)} مورد)
                </span>
                <span className="font-bold">{formatToman(c.total)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-bold">تسویه و مانده‌ها (REPORT-006)</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.settlements.byStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between p-3 text-sm">
                  <span className="text-muted-foreground">{label(s.status)} ({toFaDigits(s._count)})</span>
                  <span className="font-bold">{formatToman(s._sum.amount ?? 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <StatCard title="مجموع مانده قابل برداشت شبکه" value={formatToman(data.settlements.walletsTotalWithdrawable)} tone="emerald" />
          <StatCard title="مجموع نگه‌داشته (تسویه باز)" value={formatToman(data.settlements.walletsTotalHeld)} tone="amber" />
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold">نمایندگان برتر</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.topAgents.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">فروش نهایی‌شده‌ای ثبت نشده است.</p>
                ) : (
                  data.topAgents.map((a) => (
                    <div key={a.agent} className="flex items-center justify-between p-3 text-sm">
                      <span>{a.agent}</span>
                      <span className="font-bold">{toFaDigits(a.finalizedSales)} فروش نهایی</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold">رشد ماه جاری (REPORT-010)</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard title="کاربر جدید" value={toFaDigits(data.growthThisMonth.users)} />
            <StatCard title="خرید مستقیم" value={toFaDigits(data.growthThisMonth.purchases)} tone="sky" />
            <StatCard title="پرونده فروش" value={toFaDigits(data.growthThisMonth.sales)} tone="violet" />
            <StatCard title="ویزیت" value={toFaDigits(data.growthThisMonth.visits)} tone="emerald" />
            <StatCard title="درخواست پزشک" value={toFaDigits(data.growthThisMonth.doctors)} tone="amber" />
          </div>
        </div>
      </div>
    </div>
  )
}
