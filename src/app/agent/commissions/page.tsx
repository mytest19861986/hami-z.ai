"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge, TypeBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { JalaliDateInput, JalaliDate, toIsoDate, formatJalaliNumeric } from "@/components/admin/jalali-date-input"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman, formatPercent } from "@/lib/format"
import { faDate } from "@/lib/jalali"
import { COMMISSION_TYPE_LABELS, label } from "@/constants/labels"
import { CalendarDays } from "lucide-react"

interface CommissionItem {
  id: string
  type: string
  planTitle: string
  baseAmount: number
  percent: number
  amount: number
  status: string
  customer: string | null
  createdAt: string
  approvedAt: string | null
}

interface CommissionsData {
  items: CommissionItem[]
  byStatus: { status: string; total: number; count: number }[]
  pendingTotal: number
}

export default function AgentCommissionsPage() {
  const [data, setData] = useState<CommissionsData | null>(null)
  // فیلترها: نوع، وضعیت و بازه تاریخ شمسی (UX-002)
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [range, setRange] = useState<{ from: JalaliDate | null; to: JalaliDate | null }>({ from: null, to: null })
  const [loadedKey, setLoadedKey] = useState("")

  const requestKey = JSON.stringify([type, status, range])
  const loading = requestKey !== loadedKey

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    if (range.from && range.to) {
      params.set("from", toIsoDate(range.from))
      params.set("to", toIsoDate(range.to))
    }
    api
      .get<CommissionsData>(`/api/v1/agent/commissions?${params.toString()}`)
      .then((d) => {
        if (!mounted) return
        setData(d)
        setLoadedKey(requestKey)
      })
      .catch((e) => {
        if (mounted) toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
        if (mounted) setLoadedKey(requestKey)
      })
    return () => {
      mounted = false
    }
  }, [requestKey])

  function refresh() {
    const params = new URLSearchParams()
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    if (range.from && range.to) {
      params.set("from", toIsoDate(range.from))
      params.set("to", toIsoDate(range.to))
    }
    api.get<CommissionsData>(`/api/v1/agent/commissions?${params.toString()}`).then(setData).catch(() => {})
  }

  return (
    <div>
      <PageHeader title="پورسانت‌ها" description="ریز پورسانت‌های فروش و معرفی با تفکیک وضعیت — قابل فیلتر با نوع، وضعیت و بازه تاریخ (REF-010 · AGENT-DASH-006)" />

      {loading && !data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          {/* فیلترها: نوع + وضعیت + بازه تاریخ شمسی */}
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={type || "ALL"} onValueChange={(v) => setType(v === "ALL" ? "" : v)}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">هر دو نوع</SelectItem>
                  <SelectItem value="SALE">پورسانت فروش</SelectItem>
                  <SelectItem value="REFERRAL">پورسانت معرفی</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="PENDING">در انتظار تأیید</SelectItem>
                  <SelectItem value="APPROVED">تأییدشده</SelectItem>
                  <SelectItem value="PAID">پرداخت‌شده</SelectItem>
                  <SelectItem value="CANCELLED">لغوشده</SelectItem>
                </SelectContent>
              </Select>
              {/* کلیک روی کارت وضعیت = فیلتر سریع همان وضعیت */}
              <div className="flex flex-1 flex-wrap gap-2">
                {(data?.byStatus ?? []).map((s) => (
                  <button
                    key={s.status}
                    onClick={() => setStatus(status === s.status ? "" : s.status)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${status === s.status ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {label(s.status)}: {s.count}
                  </button>
                ))}
              </div>
            </div>
            {/* فیلتر بازه تاریخ شمسی */}
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 lg:flex-row lg:items-center">
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
                  `نمایش پورسانت‌های ${formatJalaliNumeric(range.from)} تا ${formatJalaliNumeric(range.to)}`
                ) : "بدون محدودیت تاریخ (هر دو تاریخ را انتخاب کنید تا بازه اعمال شود)"}
              </div>
            </div>
          </div>

          {data && data.items.length === 0 ? (
            <EmptyState title="پورسانتی یافت نشد" description="با فیلترهای انتخابی پورسانی ثبت نشده است." />
          ) : data ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {data.items.map((c) => (
                    <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <TypeBadge tone={c.type === "SALE" ? "emerald" : "violet"}>{COMMISSION_TYPE_LABELS[c.type] ?? c.type}</TypeBadge>
                          <StatusBadge status={c.status} />
                          <span className="text-sm font-medium">{c.planTitle}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.customer ? `مشتری: ${c.customer} · ` : ""}مبنا: {formatToman(c.baseAmount)} × {formatPercent(c.percent)} · {faDate(c.createdAt)}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-primary sm:text-left">{formatToman(c.amount)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
