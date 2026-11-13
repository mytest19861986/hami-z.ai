"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { JalaliDateInput, JalaliDate, toIsoDate, formatJalaliNumeric } from "@/components/admin/jalali-date-input"
import { api } from "@/lib/client"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { Wallet, Clock, Lock, CalendarDays } from "lucide-react"
import { toFaDigits } from "@/lib/jalali"

interface WalletData {
  withdrawableBalance: number
  heldBalance: number
  pendingCommission: number
  filtered: boolean
  transactions: {
    id: string
    type: string
    amount: number
    withdrawableDelta: number
    heldDelta: number
    balanceAfter: number
    note: string | null
    createdAt: string
  }[]
}

export default function AgentWalletPage() {
  const [data, setData] = useState<WalletData | null>(null)
  // فیلتر بازه تاریخ شمسی (UX-002): فقط گردش مالی را محدود می‌کند؛ مانده‌ها کل واقعی‌اند
  const [range, setRange] = useState<{ from: JalaliDate | null; to: JalaliDate | null }>({ from: null, to: null })

  useEffect(() => {
    const params = new URLSearchParams()
    if (range.from && range.to) {
      params.set("from", toIsoDate(range.from))
      params.set("to", toIsoDate(range.to))
    }
    const qs = params.toString()
    api.get<WalletData>(`/api/v1/agent/wallet${qs ? `?${qs}` : ""}`).then(setData).catch(() => {})
  }, [range])

  if (!data) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 rounded-xl" /></div>
  }

  return (
    <div>
      <PageHeader title="کیف پول" description="مانده‌ها و گردش مالی شما — مانده قابل برداشت فقط از پورسانت‌های تأییدشده تشکیل می‌شود (WALLET-002)." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="مانده قابل برداشت" value={formatToman(data.withdrawableBalance)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard title="در انتظار تأیید (پورسانت)" value={formatToman(data.pendingCommission)} tone="amber" icon={<Clock className="h-4 w-4" />} />
        <StatCard title="نگه‌داشته برای تسویه" value={formatToman(data.heldBalance)} tone="sky" icon={<Lock className="h-4 w-4" />} />
      </div>

      {/* فیلتر بازه تاریخ شمسی گردش مالی (UX-002) */}
      <div className="mt-6 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarDays className="size-4" />
          بازه تاریخ (شمسی)
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">از تاریخ</span>
          <JalaliDateInput aria-label="تاریخ شروع بازه" value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">تا تاریخ</span>
          <JalaliDateInput aria-label="تاریخ پایان بازه" value={range.to} onChange={(to) => setRange((r) => ({ ...r, to }))} />
        </div>
        {(range.from || range.to) && (
          <Button variant="ghost" size="sm" className="self-end lg:self-center" onClick={() => setRange({ from: null, to: null })}>
            پاک‌کردن بازه
          </Button>
        )}
        <div className="text-xs text-muted-foreground lg:mr-auto">
          {range.from && range.to ? (
            `نمایش گردش ${formatJalaliNumeric(range.from)} تا ${formatJalaliNumeric(range.to)}`
          ) : "بدون محدودیت تاریخ (هر دو تاریخ را انتخاب کنید تا بازه اعمال شود)"}
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">
        گردش مالی ({toFaDigits(data.transactions.length)} تراکنش{data.filtered ? " در بازهٔ انتخابی" : ""})
      </h2>
      {data.transactions.length === 0 ? (
        <EmptyState title="گردشی در این بازه ثبت نشده است" description="با تأیید پورسانت‌ها توسط مدیر، گردش کیف پول شما اینجا ثبت می‌شود." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-sm font-medium">{label(t.type)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t.note ?? "—"} · {faDateTime(t.createdAt)}</div>
                  </div>
                  <div className="text-left">
                    <div className={`text-sm font-bold ${t.withdrawableDelta > 0 ? "text-emerald-700" : t.withdrawableDelta < 0 ? "text-rose-600" : ""}`}>
                      {t.withdrawableDelta !== 0 ? `${t.withdrawableDelta > 0 ? "+" : ""}${formatToman(t.withdrawableDelta).replace(" تومان", "")}` : formatToman(t.amount).replace(" تومان", "")}
                    </div>
                    <div className="text-xs text-muted-foreground">مانده بعد: {formatToman(t.balanceAfter)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
