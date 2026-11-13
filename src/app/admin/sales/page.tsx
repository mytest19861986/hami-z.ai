"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { JalaliDateInput, JalaliDate, toIsoDate, formatJalaliNumeric } from "@/components/admin/jalali-date-input"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { label as L } from "@/constants/labels"
import { Search, CalendarDays } from "lucide-react"

interface SaleRow {
  id: string
  agentName: string
  agentMobile: string
  holder: string
  holderNationalCode: string | null
  holderMobile: string | null
  planTitle: string
  planPrice: number
  status: string
  address: string | null
  cardNumber: string | null
  paymentAmount: number | null
  paymentTrackingCode: string | null
  rejectReason: string | null
  returnReason: string | null
  hasMembership: boolean
  createdAt: string
  nextTransitions: string[]
}

interface SalesResponse {
  total: number
  page: number
  totalPages: number
  sales: SaleRow[]
}

export default function AdminSalesPage() {
  const [data, setData] = useState<SalesResponse | null>(null)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [dialog, setDialog] = useState<{ mode: "card" | "payment" | "reject" | "return"; sale: SaleRow } | null>(null)
  const [cardNumber, setCardNumber] = useState("")
  // صدور کارت: پیش‌فرض = تولید خودکار شماره یکتا؛ ادمین می‌تواند دستی وارد کند
  const [cardMode, setCardMode] = useState<"AUTO" | "MANUAL">("AUTO")
  const [cardChecking, setCardChecking] = useState(false)
  const [cardTaken, setCardTaken] = useState(false)
  const [amount, setAmount] = useState("")
  const [payTracking, setPayTracking] = useState("")
  const [reason, setReason] = useState("")
  // فیلتر بازه تاریخ شمسی (UX-002): هر دو تاریخ باید با هم اعمال شوند
  const [range, setRange] = useState<{ from: JalaliDate | null; to: JalaliDate | null }>({ from: null, to: null })
  const [rangeError, setRangeError] = useState("")

  const requestKey = JSON.stringify([q, status, page, range])
  const loading = requestKey !== loadedKey

  function fetchUrl() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    if (range.from && range.to) {
      params.set("from", toIsoDate(range.from))
      params.set("to", toIsoDate(range.to))
    }
    params.set("page", String(page))
    return `/api/v1/admin/sales?${params.toString()}`
  }

  useEffect(() => {
    let mounted = true
    api
      .get<SalesResponse>(fetchUrl())
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

  async function act(body: Record<string, unknown>, msg: string) {
    try {
      await api.post("/api/v1/admin/sales", body)
      toast({ title: msg })
      setDialog(null)
      setReason("")
      setCardNumber("")
      setAmount("")
      setPayTracking("")
      api.get<SalesResponse>(fetchUrl()).then(setData).catch(() => {})
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  const TRANSITION_LABELS: Record<string, string> = {
    APPROVED: "تأیید پرونده",
    CARD_ISSUED: "ثبت صدور کارت",
    SENT: "ثبت ارسال",
    DELIVERED: "ثبت تحویل",
    FINALIZED: "نهایی‌کردن فروش",
  }

  return (
    <div>
      <PageHeader
        title="فروش و چرخه کارت"
        description="بررسی پرونده‌های فروش نمایندگان و ثبت مراحل کارت، پرداخت و نهایی‌سازی (SALE-004..013 · BR-12)"
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="نام/کد ملی مشتری یا موبایل نماینده…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
          </div>
          <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
              {["PENDING_REVIEW", "APPROVED", "CARD_ISSUED", "SENT", "DELIVERED", "PAYMENT_REGISTERED", "FINALIZED", "REJECTED", "RETURNED"].map((s) => (
                <SelectItem key={s} value={s}>{L(s)}</SelectItem>
              ))}
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
              `نمایش پرونده‌های ${formatJalaliNumeric(range.from)} تا ${formatJalaliNumeric(range.to)}`
            ) : "بدون محدودیت تاریخ (هر دو تاریخ را انتخاب کنید تا بازه اعمال شود)"}
          </div>
        </div>
        {rangeError ? <p className="text-xs text-rose-600">{rangeError}</p> : null}
      </div>

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} پرونده</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.sales.map((s) => (
                  <div key={s.id} className="flex flex-col gap-2 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{s.holder}</span>
                        <StatusBadge status={s.status} />
                        <span className="text-xs text-muted-foreground">{s.planTitle} · {formatToman(s.planPrice)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        نماینده: {s.agentName} (<span dir="ltr">{s.agentMobile}</span>) · مشتری: <span dir="ltr">{s.holderNationalCode ?? "—"}</span> · ثبت: {faDateTime(s.createdAt)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {s.address ? `نشانی: ${s.address}` : ""}
                        {s.cardNumber ? ` · کارت: ${s.cardNumber}` : ""}
                        {s.paymentAmount ? ` · پرداخت ثبت‌شده: ${formatToman(s.paymentAmount)}` : ""}
                      </div>
                      {s.rejectReason ? <div className="mt-0.5 text-xs text-rose-600">رد: {s.rejectReason}</div> : null}
                      {s.returnReason ? <div className="mt-0.5 text-xs text-rose-600">مرجوعی: {s.returnReason}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.status === "PENDING_REVIEW" ? (
                        <>
                          <Button size="sm" onClick={() => act({ action: "transition", saleId: s.id, to: "APPROVED" }, "پرونده تأیید شد")}>تأیید</Button>
                          <Button size="sm" variant="destructive" onClick={() => setDialog({ mode: "reject", sale })}>رد</Button>
                        </>
                      ) : null}
                      {s.nextTransitions.includes("CARD_ISSUED") ? (
                        <Button size="sm" variant="outline" onClick={() => { setCardNumber(""); setCardMode("AUTO"); setCardTaken(false); setDialog({ mode: "card", sale: s }) }}>صدور کارت</Button>
                      ) : null}
                      {s.nextTransitions.includes("SENT") ? (
                        <Button size="sm" variant="outline" onClick={() => act({ action: "transition", saleId: s.id, to: "SENT" }, "ارسال ثبت شد")}>ثبت ارسال</Button>
                      ) : null}
                      {s.nextTransitions.includes("DELIVERED") ? (
                        <Button size="sm" variant="outline" onClick={() => act({ action: "transition", saleId: s.id, to: "DELIVERED" }, "تحویل ثبت شد")}>ثبت تحویل</Button>
                      ) : null}
                      {s.nextTransitions.includes("PAYMENT_REGISTERED") ? (
                        <Button size="sm" variant="outline" onClick={() => { setAmount(String(s.planPrice)); setPayTracking(""); setDialog({ mode: "payment", sale: s }) }}>ثبت پرداخت</Button>
                      ) : null}
                      {s.nextTransitions.includes("FINALIZED") ? (
                        <Button size="sm" onClick={() => act({ action: "transition", saleId: s.id, to: "FINALIZED" }, "فروش نهایی و عضویت + پورسانت ثبت شد")}>نهایی‌کردن فروش</Button>
                      ) : null}
                      {s.nextTransitions.includes("RETURNED") ? (
                        <Button size="sm" variant="destructive" onClick={() => { setReason(""); setDialog({ mode: "return", sale: s }) }}>مرجوعی</Button>
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

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          {dialog ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dialog.mode === "card" ? "صدور کارت" : dialog.mode === "payment" ? "ثبت پرداخت فروش" : dialog.mode === "reject" ? "رد پرونده فروش" : "مرجوعی فروش"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/60 p-3 text-xs">
                  {dialog.sale.holder} · {dialog.sale.planTitle} · نماینده: {dialog.sale.agentName}
                </div>

                {dialog.mode === "card" ? (
                  <>
                    {/* حالت صدور: خودکار (تولید شماره یکتا) یا دستی (با چک یکتایی) */}
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-1">
                      <button
                        type="button"
                        onClick={() => { setCardMode("AUTO"); setCardNumber(""); setCardTaken(false) }}
                        className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${cardMode === "AUTO" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        تولید خودکار (پیشنهادی)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCardMode("MANUAL"); setCardTaken(false) }}
                        className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${cardMode === "MANUAL" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        ورود دستی شماره
                      </button>
                    </div>

                    {cardMode === "AUTO" ? (
                      <p className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                        سیستم هنگام ثبت، یک شماره کارت یکتای پیش‌فرض (مثل HK-2026-000001) که قبلاً استفاده نشده باشد به‌صورت خودکار اختصاص می‌دهد.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <Label>شماره/شناسه کارت صادرشده *</Label>
                        <Input
                          dir="ltr"
                          value={cardNumber}
                          onChange={(e) => {
                            setCardNumber(e.target.value)
                            setCardTaken(false)
                            // چک یکتایی با توقف ۵۰۰ms پس از آخرین تایپ
                            const v = e.target.value.trim()
                            if (v.length >= 3) {
                              setCardChecking(true)
                              window.clearTimeout((window as unknown as { __cardCheckTimer?: number }).__cardCheckTimer)
                              ;(window as unknown as { __cardCheckTimer?: number }).__cardCheckTimer = window.setTimeout(async () => {
                                try {
                                  const res = await api.get<{ taken: boolean }>(`/api/v1/admin/sales?checkCard=${encodeURIComponent(v)}`)
                                  setCardTaken(res.taken)
                                } catch { /* خطای چک مانع ثبت نیست؛ سرور هم دوباره چک می‌کند */ }
                                finally { setCardChecking(false) }
                              }, 500)
                            }
                          }}
                          className="text-left"
                          placeholder="HK-2026-0001"
                        />
                        <p className="text-xs">
                          {cardChecking ? (
                            <span className="text-muted-foreground">در حال بررسی یکتایی شماره…</span>
                          ) : cardTaken ? (
                            <span className="font-medium text-rose-600">این شماره قبلاً استفاده شده است؛ شماره دیگری وارد کنید.</span>
                          ) : cardNumber.trim().length >= 3 ? (
                            <span className="font-medium text-emerald-700">این شماره آزاد است. ✓</span>
                          ) : (
                            <span className="text-muted-foreground">یکتایی شماره هنگام تایپ بررسی می‌شود.</span>
                          )}
                        </p>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      disabled={cardMode === "MANUAL" && (cardChecking || cardTaken || cardNumber.trim().length < 3)}
                      onClick={() =>
                        act(
                          {
                            action: "transition",
                            saleId: dialog.sale.id,
                            to: "CARD_ISSUED",
                            // حالت خودکار: cardNumber ارسال نمی‌شود تا سر شماره یکتا تولید کند
                            ...(cardMode === "MANUAL" ? { cardNumber } : {}),
                          },
                          "صدور کارت ثبت شد"
                        )
                      }
                    >
                      ثبت صدور
                    </Button>
                  </>
                ) : dialog.mode === "payment" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>مبلغ پرداخت‌شده (تومان) *</Label>
                      <Input dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className="text-left" />
                      <p className="text-xs text-muted-foreground">مبنای محاسبه پورسانت، مبلغ پرداخت ثبت‌شده است.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>کد پیگیری پرداخت</Label>
                      <Input dir="ltr" value={payTracking} onChange={(e) => setPayTracking(e.target.value)} className="text-left" />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!amount || parseInt(amount, 10) < 1000}
                      onClick={() => act({ action: "register_payment", saleId: dialog.sale.id, amount: parseInt(amount, 10), paymentTrackingCode: payTracking }, "پرداخت ثبت شد")}
                    >
                      ثبت پرداخت
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>دلیل {dialog.mode === "reject" ? "رد" : "مرجوعی"} (الزامی)</Label>
                      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </div>
                    {dialog.mode === "return" ? (
                      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                        با ثبت مرجوعی، عضویت فعال این پرونده لغو و پورسانت آن (در صورت تسویه‌نشده بودن) باطل می‌شود. اگر پورسانت پرداخت شده باشد، عملیات متوقف و نیازمند اصلاح دستی مدیر ارشد است.
                      </p>
                    ) : null}
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={reason.trim().length < 3}
                      onClick={() =>
                        dialog.mode === "reject"
                          ? act({ action: "reject", saleId: dialog.sale.id, reason }, "پرونده رد شد")
                          : act({ action: "return", saleId: dialog.sale.id, reason }, "مرجوعی ثبت و آثار آن اصلاح شد")
                      }
                    >
                      ثبت نهایی
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
