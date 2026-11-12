"use client"

// مودال «مشاهده جزئیات» — دکمهٔ عملیات در صفحهٔ کاربران ادمین (ADMIN-002)
// گزارش فعالیت کاربر: بازهٔ زمانی شمسی، ۹ کارت آماری، سوابق خرید و پورسانت
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errMessage } from "@/lib/client"
import { formatNumber, formatToman } from "@/lib/format"
import { faDate } from "@/lib/jalali"
import { toast } from "@/hooks/use-toast"
import {
  JalaliDateInput,
  dateToJalali,
  formatJalaliNumeric,
  jalaliToDate,
  toIsoDate,
  type JalaliDate,
} from "./jalali-date-input"
import {
  BadgeCheck,
  BadgePercent,
  CheckCircle2,
  Coins,
  CreditCard,
  ShoppingCart,
  Stethoscope,
  UserPlus,
  RotateCw,
  Wallet,
} from "lucide-react"

export interface UserDetailsTarget {
  id: string
  name: string
  mobile: string
  status: string
}

interface StatsResponse {
  user: { id: string; name: string; mobile: string; status: string }
  from: string
  to: string
  totals: {
    purchases: number
    purchasesSuccess: number
    purchasesPending: number
    totalPaid: number
    activeMemberships: number
    visits: number
    discountReceived: number
    referrals: number
    commissionTotal: number
    walletWithdrawable: number
    walletHeld: number
  }
  purchases: {
    id: string
    planTitle: string
    holder: string
    amount: number
    status: string
    trackingCode: string
    createdAt: string
  }[]
  commissions: {
    id: string
    type: string
    planTitle: string
    customer: string | null
    amount: number
    status: string
    createdAt: string
  }[]
}

function currentMonthRange(): { from: JalaliDate; to: JalaliDate } {
  const today = dateToJalali(new Date())
  return { from: { jy: today.jy, jm: today.jm, jd: 1 }, to: today }
}

export function UserDetailsModal({
  user,
  onClose,
}: {
  user: UserDetailsTarget | null
  onClose: () => void
}) {
  const [range, setRange] = useState<{ from: JalaliDate; to: JalaliDate }>(currentMonthRange)
  const [applied, setApplied] = useState<{ from: JalaliDate; to: JalaliDate }>(currentMonthRange)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const appliedKey = user ? `${user.id}|${toIsoDate(applied.from)}|${toIsoDate(applied.to)}` : ""

  // با هر بار باز شدن مودال برای کاربر جدید، بازه به ماه جاری بازمی‌گردد
  useEffect(() => {
    if (user) {
      const r = currentMonthRange()
      setRange(r)
      setApplied(r)
      setStats(null)
    }
  }, [user?.id])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const d = await api.get<StatsResponse>(
        `/api/v1/admin/users/stats?userId=${encodeURIComponent(user.id)}&from=${toIsoDate(applied.from)}&to=${toIsoDate(applied.to)}`
      )
      setStats(d)
    } catch (e) {
      toast({ title: "خطا در دریافت جزئیات کاربر", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [appliedKey])

  useEffect(() => {
    if (user) load()
  }, [appliedKey])

  function refresh() {
    if (jalaliToDate(range.from) > jalaliToDate(range.to)) {
      toast({ title: "بازهٔ زمانی نامعتبر است", description: "تاریخ شروع باید قبل از تاریخ پایان باشد.", variant: "destructive" })
      return
    }
    setApplied({ from: range.from, to: range.to })
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {user ? (
          <>
            <DialogHeader>
              <DialogTitle>جزئیات کاربر</DialogTitle>
              <DialogDescription>
                {user.name} · <span dir="ltr">{user.mobile}</span>
              </DialogDescription>
            </DialogHeader>

            {/* بازهٔ زمانی + دکمهٔ به روز رسانی */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <span className="block text-xs text-muted-foreground">از تاریخ</span>
                <JalaliDateInput
                  aria-label="تاریخ شروع"
                  value={range.from}
                  onChange={(from) => setRange((r) => ({ ...r, from }))}
                />
              </div>
              <div className="space-y-1">
                <span className="block text-xs text-muted-foreground">تا تاریخ</span>
                <JalaliDateInput
                  aria-label="تاریخ پایان"
                  value={range.to}
                  onChange={(to) => setRange((r) => ({ ...r, to }))}
                />
              </div>
              <Button onClick={refresh} disabled={loading}>
                <RotateCw className={loading ? "size-4 animate-spin" : "size-4"} />
                به روز رسانی
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              گزارش از {formatJalaliNumeric(applied.from)} تا {formatJalaliNumeric(applied.to)}
            </p>

            {/* کارت‌های آماری */}
            {loading && !stats ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard title="خرید ثبت‌شده" value={formatNumber(stats.totals.purchases)} icon={<ShoppingCart className="size-4" />} tone="sky" />
                <StatCard title="خرید موفق" value={formatNumber(stats.totals.purchasesSuccess)} icon={<CheckCircle2 className="size-4" />} tone="emerald" />
                <StatCard title="مبلغ پرداختی" value={formatToman(stats.totals.totalPaid)} icon={<CreditCard className="size-4" />} tone="emerald" />
                <StatCard title="اشتراک فعال" value={formatNumber(stats.totals.activeMemberships)} icon={<BadgeCheck className="size-4" />} tone="sky" />
                <StatCard title="ویزیت انجام‌شده" value={formatNumber(stats.totals.visits)} icon={<Stethoscope className="size-4" />} tone="violet" />
                <StatCard title="تخفیف دریافتی ویزیت" value={formatToman(stats.totals.discountReceived)} icon={<BadgePercent className="size-4" />} tone="violet" />
                <StatCard title="کاربر معرفی‌شده" value={formatNumber(stats.totals.referrals)} icon={<UserPlus className="size-4" />} tone="sky" />
                <StatCard title="پورسانت کسب‌شده" value={formatToman(stats.totals.commissionTotal)} icon={<Coins className="size-4" />} tone="violet" />
                <StatCard
                  title="موجودی کیف پول"
                  value={formatToman(stats.totals.walletWithdrawable + stats.totals.walletHeld)}
                  hint={`قابل برداشت: ${formatToman(stats.totals.walletWithdrawable)} · در انتظار: ${formatToman(stats.totals.walletHeld)}`}
                  icon={<Wallet className="size-4" />}
                  tone="amber"
                />
              </div>
            ) : null}

            {/* سوابق خرید + پورسانت‌ها */}
            {stats ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <h3 className="mb-2 text-sm font-semibold">سوابق خرید</h3>
                  {stats.purchases.length === 0 ? (
                    <p className="text-xs leading-6 text-muted-foreground">در این بازه خریدی توسط این کاربر ثبت نشده است.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="py-1.5 text-right font-medium">طرح</th>
                          <th className="py-1.5 text-right font-medium">دارنده</th>
                          <th className="py-1.5 text-left font-medium">مبلغ (تومان)</th>
                          <th className="py-1.5 text-center font-medium">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.purchases.map((p) => (
                          <tr key={p.id} className="border-t" title={`${faDate(p.createdAt)} · کد پیگیری: ${p.trackingCode}`}>
                            <td className="py-2 font-medium">{p.planTitle}</td>
                            <td className="py-2 text-muted-foreground">{p.holder}</td>
                            <td className="py-2 text-left font-bold tabular-nums">{formatNumber(p.amount)}</td>
                            <td className="py-2 text-center"><StatusBadge status={p.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <h3 className="mb-2 text-sm font-semibold">پورسانت‌های کسب‌شده</h3>
                  {stats.commissions.length === 0 ? (
                    <p className="text-xs leading-6 text-muted-foreground">در این بازه پورسانتی برای این کاربر ثبت نشده است.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="py-1.5 text-right font-medium">مشتری</th>
                          <th className="py-1.5 text-right font-medium">طرح</th>
                          <th className="py-1.5 text-left font-medium">مبلغ (تومان)</th>
                          <th className="py-1.5 text-center font-medium">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.commissions.map((c) => (
                          <tr key={c.id} className="border-t" title={faDate(c.createdAt)}>
                            <td className="py-2 font-medium">{c.customer ?? "—"}</td>
                            <td className="py-2 text-muted-foreground">{c.planTitle}</td>
                            <td className="py-2 text-left font-bold tabular-nums">{formatNumber(c.amount)}</td>
                            <td className="py-2 text-center"><StatusBadge status={c.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
