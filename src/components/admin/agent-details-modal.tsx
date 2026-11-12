"use client"

// مودال «مشاهده جزئیات» — دکمهٔ عملیات در صفحهٔ نمایندگان فروش ادمین (ADMIN-007)
// عملکرد هنگام فروش: بازهٔ زمانی شمسی، ۹ کارت آماری، سوابق پورسانت و سوابق تسویه
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
  Ban,
  CheckCircle2,
  Coins,
  CreditCard,
  Hourglass,
  Landmark,
  ReceiptText,
  RotateCw,
  Undo2,
  UserPlus,
  Wallet,
  X,
} from "lucide-react"

export interface AgentDetailsTarget {
  id: string
  name: string
  businessName?: string | null
  status: string
}

interface StatsResponse {
  agent: { id: string; name: string; businessName: string | null }
  from: string
  to: string
  totals: {
    customers: number
    paid: number
    finalized: number
    returned: number
    commissionTotal: number
    commissionPaid: number
    commissionPending: number
    commissionPayable: number
    openSettlements: number
    openSettlementsCount: number
  }
  commissions: {
    id: string
    type: string
    planTitle: string
    customer: string | null
    amount: number
    status: string
    createdAt: string
  }[]
  settlements: {
    id: string
    amount: number
    status: string
    trackingCode: string
    createdAt: string
  }[]
}

function currentMonthRange(): { from: JalaliDate; to: JalaliDate } {
  const today = dateToJalali(new Date())
  return { from: { jy: today.jy, jm: today.jm, jd: 1 }, to: today }
}

export function AgentDetailsModal({
  agent,
  onClose,
  onReject,
  onSuspend,
}: {
  agent: AgentDetailsTarget | null
  onClose: () => void
  onReject: (agentId: string) => void
  onSuspend: (agentId: string) => void
}) {
  const [range, setRange] = useState<{ from: JalaliDate; to: JalaliDate }>(currentMonthRange)
  const [applied, setApplied] = useState<{ from: JalaliDate; to: JalaliDate }>(currentMonthRange)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const appliedKey = agent ? `${agent.id}|${toIsoDate(applied.from)}|${toIsoDate(applied.to)}` : ""

  // با هر بار باز شدن مودال برای نماینده جدید، بازه به ماه جاری بازمی‌گردد
  useEffect(() => {
    if (agent) {
      const r = currentMonthRange()
      setRange(r)
      setApplied(r)
      setStats(null)
    }
  }, [agent?.id])

  const load = useCallback(async () => {
    if (!agent) return
    setLoading(true)
    try {
      const d = await api.get<StatsResponse>(
        `/api/v1/admin/agents/stats?agentId=${encodeURIComponent(agent.id)}&from=${toIsoDate(applied.from)}&to=${toIsoDate(applied.to)}`
      )
      setStats(d)
    } catch (e) {
      toast({ title: "خطا در دریافت عملکرد فروش", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [appliedKey])

  useEffect(() => {
    if (agent) load()
  }, [appliedKey])

  function refresh() {
    if (jalaliToDate(range.from) > jalaliToDate(range.to)) {
      toast({ title: "بازهٔ زمانی نامعتبر است", description: "تاریخ شروع باید قبل از تاریخ پایان باشد.", variant: "destructive" })
      return
    }
    setApplied({ from: range.from, to: range.to })
  }

  return (
    <Dialog open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {agent ? (
          <>
            <DialogHeader>
              <DialogTitle>عملکرد هنگام فروش</DialogTitle>
              <DialogDescription>
                {agent.name}
                {agent.businessName ? ` · ${agent.businessName}` : ""}
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
                <StatCard title="مشتری ثبت‌شده" value={formatNumber(stats.totals.customers)} icon={<UserPlus className="size-4" />} tone="sky" />
                <StatCard title="پرداخت‌شده" value={formatNumber(stats.totals.paid)} icon={<CreditCard className="size-4" />} tone="emerald" />
                <StatCard title="تأیید نهایی" value={formatNumber(stats.totals.finalized)} icon={<CheckCircle2 className="size-4" />} tone="emerald" />
                <StatCard title="مرجوعی" value={formatNumber(stats.totals.returned)} icon={<Undo2 className="size-4" />} tone="rose" />
                <StatCard title="مجموع پورسانت" value={formatToman(stats.totals.commissionTotal)} icon={<Coins className="size-4" />} tone="violet" />
                <StatCard title="پورسانت پرداخت‌شده" value={formatToman(stats.totals.commissionPaid)} icon={<Wallet className="size-4" />} tone="emerald" />
                <StatCard title="پورسانت در انتظار تأیید" value={formatToman(stats.totals.commissionPending)} icon={<Hourglass className="size-4" />} tone="amber" />
                <StatCard title="پورسانت قابل پرداخت" value={formatToman(stats.totals.commissionPayable)} icon={<Landmark className="size-4" />} tone="sky" />
                <StatCard
                  title="درخواست تسویه باز"
                  value={formatToman(stats.totals.openSettlements)}
                  hint={stats.totals.openSettlementsCount > 0 ? `${formatNumber(stats.totals.openSettlementsCount)} درخواست در انتظار بررسی` : "درخواست بازی وجود ندارد"}
                  icon={<ReceiptText className="size-4" />}
                  tone="rose"
                />
              </div>
            ) : null}

            {/* سوابق پورسانت + سوابق تسویه */}
            {stats ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <h3 className="mb-2 text-sm font-semibold">سوابق پورسانت</h3>
                  {stats.commissions.length === 0 ? (
                    <p className="text-xs leading-6 text-muted-foreground">در این بازه پورسانتی برای این همکار فروش ثبت نشده است.</p>
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
                <div className="rounded-lg border p-3">
                  <h3 className="mb-2 text-sm font-semibold">سوابق تسویه</h3>
                  {stats.settlements.length === 0 ? (
                    <p className="text-xs leading-6 text-muted-foreground">در این بازه درخواست تسویه‌ای برای این همکار فروش ثبت نشده است.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.settlements.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-2">
                          <div>
                            <div className="text-xs font-bold tabular-nums">{formatToman(s.amount)}</div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {faDate(s.createdAt)} · کد پیگیری: <span dir="ltr">{s.trackingCode}</span>
                            </div>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* اقدام‌های مدیریتی (رد / تعلیق با ثبت دلیل) */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              <Button variant="outline" disabled={agent.status !== "APPROVED"} onClick={() => onSuspend(agent.id)}>
                <Ban className="size-4" />
                تعلیق
              </Button>
              <Button variant="destructive" disabled={agent.status === "REJECTED"} onClick={() => onReject(agent.id)}>
                <X className="size-4" />
                رد
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
