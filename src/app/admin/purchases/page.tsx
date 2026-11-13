"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { JalaliDateInput, JalaliDate, toIsoDate, formatJalaliNumeric } from "@/components/admin/jalali-date-input"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { Search, CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface PurchaseRow {
  id: string
  trackingCode: string
  planTitle: string
  buyer: string
  buyerMobile: string
  holder: string
  holderNationalCode: string | null
  amount: number
  referrerMobile: string | null
  status: string
  rejectReason: string | null
  hasMembership: boolean
  createdAt: string
}

interface PurchasesResponse {
  total: number
  page: number
  totalPages: number
  purchases: PurchaseRow[]
}

export default function AdminPurchasesPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<PurchasesResponse | null>(null)
  const [q, setQ] = useState("")
  // فیلتر وضعیت از پارامتر آدرس (لینک داشبورد/اعلان: ?status=PENDING) خوانده می‌شود
  const statusParam = searchParams.get("status") ?? ""
  const [status, setStatus] = useState(statusParam)
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [seenStatusParam, setSeenStatusParam] = useState(statusParam)
  const [rejectItem, setRejectItem] = useState<PurchaseRow | null>(null)
  const [reason, setReason] = useState("")
  // فیلتر بازه تاریخ شمسی (UX-002): هر دو تاریخ باید با هم اعمال شوند
  const [range, setRange] = useState<{ from: JalaliDate | null; to: JalaliDate | null }>({ from: null, to: null })
  const [rangeError, setRangeError] = useState("")

  const requestKey = JSON.stringify([q, status, page, range])
  const loading = requestKey !== loadedKey

  // همگام‌سازی فیلتر وضعیت با پارامتر آدرس هنگام باز شدن از لینک داشبورد/اعلان
  // (الگوی «state در طول رندر» توصیه‌شدهٔ React به‌جای setState داخل effect)
  if (statusParam !== seenStatusParam) {
    setSeenStatusParam(statusParam)
    setStatus(statusParam)
    setPage(1)
  }

  function fetchUrl() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    if (range.from && range.to) {
      params.set("from", toIsoDate(range.from))
      params.set("to", toIsoDate(range.to))
    }
    params.set("page", String(page))
    return `/api/v1/admin/purchases?${params.toString()}`
  }

  useEffect(() => {
    let mounted = true
    api
      .get<PurchasesResponse>(fetchUrl())
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

  async function approve(p: PurchaseRow) {
    try {
      await api.post("/api/v1/admin/purchases", { action: "approve", purchaseId: p.id })
      toast({ title: "خرید تأیید شد", description: "عضویت فعال و در صورت وجود، پورسانت معرفی ثبت شد." })
      refresh()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  async function reject() {
    if (!rejectItem) return
    try {
      await api.post("/api/v1/admin/purchases", { action: "reject", purchaseId: rejectItem.id, reason })
      toast({ title: "درخواست رد شد" })
      setRejectItem(null)
      setReason("")
      refresh()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  function refresh() {
    api.get<PurchasesResponse>(fetchUrl()).then(setData).catch(() => {})
  }

  return (
    <div>
      <PageHeader
        title="خریدهای مستقیم"
        description="تأیید دستی پرداخت‌های خارج از سامانه — درگاه واقعی متصل نیست و هیچ پرداخت جعلی تأیید نمی‌شود (PAY-005/010)"
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="کد پیگیری یا موبایل خریدار…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
          </div>
          <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
              <SelectItem value="PENDING">در انتظار</SelectItem>
              <SelectItem value="SUCCESS">موفق</SelectItem>
              <SelectItem value="FAILED">ناموفق/ردشده</SelectItem>
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
              onChange={(from) => { setPage(1); setRangeError(""); setRange((r) => ({ ...r, from })) }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">تا تاریخ</span>
            <JalaliDateInput
              aria-label="تاریخ پایان بازه"
              value={range.to}
              onChange={(to) => { setPage(1); setRangeError(""); setRange((r) => ({ ...r, to })) }}
            />
          </div>
          {(range.from || range.to) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-end lg:self-center"
              onClick={() => { setPage(1); setRangeError(""); setRange({ from: null, to: null }) }}
            >
              پاک‌کردن بازه
            </Button>
          )}
          <div className="text-xs text-muted-foreground lg:mr-auto">
            {range.from && range.to ? (
              `نمایش خریدهای ${formatJalaliNumeric(range.from)} تا ${formatJalaliNumeric(range.to)}`
            ) : "بدون محدودیت تاریخ (هر دو تاریخ را انتخاب کنید تا بازه اعمال شود)"}
          </div>
        </div>
        {rangeError ? <p className="text-xs text-rose-600">{rangeError}</p> : null}
      </div>

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} درخواست</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.purchases.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{p.planTitle}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        خریدار: {p.buyer} (<span dir="ltr">{p.buyerMobile}</span>) · دارنده: {p.holder} · مبلغ: {formatToman(p.amount)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        کد پیگیری: <span className="font-mono" dir="ltr">{p.trackingCode}</span> · {faDateTime(p.createdAt)}
                        {p.referrerMobile ? ` · معرف: ${p.referrerMobile}` : ""}
                      </div>
                      {p.rejectReason ? <div className="mt-0.5 text-xs text-rose-600">دلیل رد: {p.rejectReason}</div> : null}
                    </div>
                    {p.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approve(p)}>تأیید و فعال‌سازی طرح</Button>
                        <Button size="sm" variant="destructive" onClick={() => setRejectItem(p)}>رد</Button>
                      </div>
                    ) : p.hasMembership ? (
                      <span className="text-xs text-emerald-700">عضویت فعال شده</span>
                    ) : null}
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
          <DialogHeader><DialogTitle>رد درخواست خرید</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              {rejectItem?.planTitle} · {formatToman(rejectItem?.amount ?? 0)} · <span className="font-mono" dir="ltr">{rejectItem?.trackingCode}</span>
            </div>
            <div className="space-y-1.5">
              <Label>دلیل رد (الزامی)</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button variant="destructive" className="w-full" disabled={reason.trim().length < 3} onClick={reject}>
              ثبت رد
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
