"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { api } from "@/lib/client"
import { formatToman } from "@/lib/format"
import { toFaDigits } from "@/lib/jalali"
import { Users, Stethoscope, Briefcase, IdCard, ShoppingBag, Truck, Coins, Landmark, ClipboardList, UserPlus } from "lucide-react"

interface DashboardData {
  users: { total: number; active: number; newThisMonth: number }
  doctors: { approved: number; pending: number }
  agents: { approved: number; pending: number }
  memberships: { active: number; ended: number }
  purchases: { pending: number; success: number }
  sales: { open: number; finalized: number }
  commissions: { pendingTotal: number; approvedTotal: number; paidTotal: number }
  settlements: { pending: number; approved: number }
  visitsTotal: number
  salesAmountThisMonth: number
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.get<DashboardData>("/api/v1/admin/dashboard").then(setData).catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  const pendingWork = [
    { href: "/admin/doctors?status=PENDING", label: "پزشک در انتظار بررسی", count: data.doctors.pending, icon: <Stethoscope className="h-4 w-4" /> },
    { href: "/admin/agents?status=PENDING", label: "نماینده در انتظار بررسی", count: data.agents.pending, icon: <Briefcase className="h-4 w-4" /> },
    { href: "/admin/purchases?status=PENDING", label: "خرید در انتظار تأیید", count: data.purchases.pending, icon: <ShoppingBag className="h-4 w-4" /> },
    { href: "/admin/sales?status=PENDING_REVIEW", label: "پرونده فروش در انتظار", count: data.sales.open, icon: <Truck className="h-4 w-4" /> },
    { href: "/admin/commissions?status=PENDING", label: "پورسانت در انتظار تأیید", count: data.commissions.pendingTotal > 0 ? -1 : 0, icon: <Coins className="h-4 w-4" />, amount: data.commissions.pendingTotal },
    { href: "/admin/settlements?status=PENDING", label: "درخواست تسویه در انتظار", count: data.settlements.pending, icon: <Landmark className="h-4 w-4" /> },
  ].filter((x) => x.count !== 0)

  return (
    <div>
      <PageHeader title="داشبورد مدیریت" description="نمای کلی عملکرد سامانه و صف‌های کاری" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="کل کاربران" value={toFaDigits(data.users.total)} hint={`${toFaDigits(data.users.active)} فعال · ${toFaDigits(data.users.newThisMonth)} جدید این ماه`} icon={<Users className="h-4 w-4" />} />
        <StatCard title="عضویت فعال" value={toFaDigits(data.memberships.active)} hint={`${toFaDigits(data.memberships.ended)} پایان‌یافته/لغو`} tone="emerald" icon={<IdCard className="h-4 w-4" />} />
        <StatCard title="پزشکان تأییدشده" value={toFaDigits(data.doctors.approved)} hint={`${toFaDigits(data.doctors.pending)} در انتظار`} tone="sky" icon={<Stethoscope className="h-4 w-4" />} />
        <StatCard title="نمایندگان تأییدشده" value={toFaDigits(data.agents.approved)} hint={`${toFaDigits(data.agents.pending)} در انتظار`} tone="violet" icon={<Briefcase className="h-4 w-4" />} />
        <StatCard title="خرید مستقیم موفق" value={toFaDigits(data.purchases.success)} hint={`${toFaDigits(data.purchases.pending)} در انتظار تأیید`} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard title="فروش نهایی نمایندگان" value={toFaDigits(data.sales.finalized)} hint={`${toFaDigits(data.sales.open)} پرونده در جریان`} tone="emerald" icon={<Truck className="h-4 w-4" />} />
        <StatCard title="پورسانت در انتظار" value={formatToman(data.commissions.pendingTotal)} tone="amber" icon={<Coins className="h-4 w-4" />} />
        <StatCard title="ویزیت‌های ثبت‌شده" value={toFaDigits(data.visitsTotal)} tone="slate" icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      {pendingWork.length > 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <UserPlus className="h-5 w-5 text-amber-600" />
              صف‌های کاری در انتظار اقدام
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingWork.map((w) => (
                <Link key={w.href} href={w.href} className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5">
                  <span className="flex items-center gap-2 text-sm">
                    {w.icon}
                    {w.label}
                  </span>
                  {"amount" in w && w.amount ? (
                    <span className="text-sm font-bold text-amber-600">{formatToman(w.amount as number)}</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800">{toFaDigits(w.count)}</span>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">پورسانت تأییدشده (قابل برداشت شبکه)</div>
            <div className="mt-1 text-xl font-bold text-emerald-700">{formatToman(data.commissions.approvedTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">پورسانت پرداخت‌شده (تسویه شده)</div>
            <div className="mt-1 text-xl font-bold">{formatToman(data.commissions.paidTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">مبلغ فروش این ماه (پرداخت ثبت‌شده)</div>
            <div className="mt-1 text-xl font-bold text-primary">{formatToman(data.salesAmountThisMonth)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
