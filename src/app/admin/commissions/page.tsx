"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge, TypeBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { JalaliDateInput, JalaliDate, toIsoDate, formatJalaliNumeric } from "@/components/admin/jalali-date-input"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman, formatPercent } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { COMMISSION_TYPE_LABELS } from "@/constants/labels"
import { Search, CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CommissionRow {
  id: string
  type: string
  beneficiary: string
  beneficiaryMobile: string
  bankInfoComplete: boolean
  planTitle: string
  customer: string | null
  baseAmount: number
  percent: number
  amount: number
  status: string
  description: string | null
  createdAt: string
}

interface CommissionsResponse {
  total: number
  page: number
  totalPages: number
  byStatus: { status: string; total: number; count: number }[]
  commissions: CommissionRow[]
}

export default function AdminCommissionsPage() {
  const [data, setData] = useState<CommissionsResponse | null>(null)
  const [q, setQ] = useState("")
  // پیش‌فرض «همه وضعیت‌ها»: صفحه اکنون تاریخچهٔ کامل پورسانت‌هاست، نه فقط صف بررسی
  const [status, setStatus] = useState("")
  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [rejectItem, setRejectItem] = useState<CommissionRow | null>(null)
  const [reason, setReason] = useState("")
  // فیلتر بازه تاریخ شمسی (UX-002): هر دو تاریخ باید با هم اعمال شوند
  const [range, setRange] = useState<{ from: JalaliDate | null; to: JalaliDate | null }>({ from: null, to: null })

  const requestKey = JSON.stringify([q, status, type, page, range])
  const loading = requestKey !== loadedKey

  function fetchUrl() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    if (type) params.set("type", type)
    if (range.from && range.to) {
      params.set("from", toIsoDate(range.from))
      params.set("to", toIsoDate(range.to))
    }
    params.set("page", String(page))
    return `/api/v1/admin/commissions?${params.toString()}`
  }

  useEffect(() => {
    let mounted = true
    api
      .get<CommissionsResponse>(fetchUrl())
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

  async function approve(c: CommissionRow) {
    try {
      await api.post("/api/v1/admin/commissions", { commissionId: c.id, decision: "APPROVE" })
      toast({ title: "پورسانت تأیید شد", description: "مبلغ به مانده قابل برداشت ذی‌نفع افزوده شد." })
      refresh()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  async function reject() {
    if (!rejectItem) return
    try {
      await api.post("/api/v1/admin/commissions", { commissionId: rejectItem.id, decision: "REJECT", reason })
      toast({ title: "پورسانت رد شد" })
      setRejectItem(null)
      setReason("")
      refresh()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  function refresh() {
    api.get<CommissionsResponse>(fetchUrl()).then(setData).catch(() => {})
  }

  return (
    <div>
      <PageHeader title="پورسانت‌ها — تاریخچه" description="تاریخچهٔ کامل پورسانت‌های فروش و معرفی + تأیید/رد — برای تأیید و واریز، ذی‌نفع باید کارت بانکی و شبا را در پروفایل تکمیل کرده باشد (REF-SYS · ADMIN-017/018)" />

      {data ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.byStatus.map((s) => (
            <button
              key={s.status}
              onClick={() => { setPage(1); setStatus(status === s.status ? "" : s.status) }}
              className="text-right"
            >
              <Card className={status === s.status ? "border-primary ring-1 ring-primary/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={s.status} />
                    <span className="text-xs text-muted-foreground">{s.count} مورد</span>
                  </div>
                  <div className="mt-2 text-lg font-bold">{formatToman(s.total)}</div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="نام یا موبایل ذی‌نفع…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
          </div>
          <Select value={type || "ALL"} onValueChange={(v) => { setPage(1); setType(v === "ALL" ? "" : v) }}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">هر دو نوع</SelectItem>
              <SelectItem value="SALE">پورسانت فروش</SelectItem>
              <SelectItem value="REFERRAL">پورسانت معرفی</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
              <SelectItem value="PENDING">در انتظار</SelectItem>
              <SelectItem value="APPROVED">تأییدشده</SelectItem>
              <SelectItem value="PAID">پرداخت‌شده</SelectItem>
              <SelectItem value="CANCELLED">لغوشده</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* فیلتر بازه تاریخ شمسی (UX-002): انتخاب روز/ماه/سال از تا + پاک‌کردن بازه */}
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-4" />
            بازه تاریخ (شمسی)
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">از تاریخ</span>
            <JalaliDateInput
              aria-label="تاریخ شروع بازه"
              value={range.from}
              onChange={(from) => { setPage(1); setRange((r) => ({ ...r, from })) }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">تا تاریخ</span>
            <JalaliDateInput
              aria-label="تاریخ پایان بازه"
              value={range.to}
              onChange={(to) => { setPage(1); setRange((r) => ({ ...r, to })) }}
            />
          </div>
          {(range.from || range.to) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-end lg:self-center"
              onClick={() => { setPage(1); setRange({ from: null, to: null }) }}
            >
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

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} مورد</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.commissions.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge tone={c.type === "SALE" ? "emerald" : "violet"}>{COMMISSION_TYPE_LABELS[c.type] ?? c.type}</TypeBadge>
                        <StatusBadge status={c.status} />
                        <span className="text-sm font-semibold">{c.beneficiary}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">{c.beneficiaryMobile}</span>
                        {/* REF-SYS: نشانگر تکمیل اطلاعات بانکی برای دریافت پورسانت */}
                        {c.status === "PENDING" ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              c.bankInfoComplete
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-800"
                            }`}
                          >
                            {c.bankInfoComplete ? "اطلاعات بانکی کامل" : "بدون کارت/شبا — قابل واریز نیست"}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.planTitle}{c.customer ? ` · مشتری: ${c.customer}` : ""} · مبنا: {formatToman(c.baseAmount)} × {formatPercent(c.percent)} · {faDateTime(c.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-primary">{formatToman(c.amount)}</span>
                      {c.status === "PENDING" ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => approve(c)}>تأیید</Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejectItem(c)}>رد</Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      ) : null}

      <Dialog open={!!rejectItem} onOpenChange={(o) => !o && setRejectItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>رد پورسانت</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              {rejectItem?.beneficiary} · {COMMISSION_TYPE_LABELS[rejectItem?.type ?? ""]} · {formatToman(rejectItem?.amount ?? 0)}
            </div>
            <div className="space-y-1.5">
              <Label>دلیل رد (الزامی)</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button variant="destructive" className="w-full" disabled={reason.trim().length < 3} onClick={reject}>ثبت رد</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
