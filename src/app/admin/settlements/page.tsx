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
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { maskCard, maskSheba } from "@/lib/validators"
import { Search } from "lucide-react"

interface SettlementRow {
  id: string
  applicant: string
  applicantMobile: string
  amount: number
  status: string
  trackingCode: string
  bankCardNumber: string
  bankSheba: string
  bankAccountName: string
  reviewNote: string | null
  paymentTrackingCode: string | null
  paymentNote: string | null
  createdAt: string
  reviewedAt: string | null
  paidAt: string | null
}

interface SettlementsResponse {
  total: number
  page: number
  totalPages: number
  settlements: SettlementRow[]
}

export default function AdminSettlementsPage() {
  const [data, setData] = useState<SettlementsResponse | null>(null)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [dialog, setDialog] = useState<{ mode: "reject" | "paid"; item: SettlementRow } | null>(null)
  const [reason, setReason] = useState("")
  const [payTracking, setPayTracking] = useState("")
  const [isSuper, setIsSuper] = useState(false)

  const requestKey = JSON.stringify([q, status, page])
  const loading = requestKey !== loadedKey

  function fetchUrl() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    params.set("page", String(page))
    return `/api/v1/admin/settlements?${params.toString()}`
  }

  useEffect(() => {
    let mounted = true
    api
      .get<SettlementsResponse>(fetchUrl())
      .then((d) => {
        if (!mounted) return
        setData(d)
        setLoadedKey(requestKey)
      })
      .catch((e) => {
        if (mounted) toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
        if (mounted) setLoadedKey(requestKey)
      })
    api
      .get<{ roles?: string[] }>("/api/v1/auth/me")
      .then((me) => {
        if (mounted) setIsSuper(!!(me as { roles?: string[] }).roles?.includes("SUPER_ADMIN"))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [requestKey])

  async function act(body: Record<string, unknown>, msg: string) {
    try {
      await api.post("/api/v1/admin/settlements", body)
      toast({ title: msg })
      setDialog(null)
      setReason("")
      setPayTracking("")
      api.get<SettlementsResponse>(fetchUrl()).then(setData).catch(() => {})
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  return (
    <div>
      <PageHeader
        title="تسویه‌ها"
        description="بررسی درخواست‌ها و ثبت وضعیت پرداخت خارج از سامانه — «پرداخت‌شده» فقط توسط مدیر ارشد ثبت می‌شود (ADMIN-020 · SETTLE-008/009)"
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="نام، موبایل یا کد پیگیری…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
        </div>
        <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="PENDING">در انتظار</SelectItem>
            <SelectItem value="APPROVED">تأییدشده</SelectItem>
            <SelectItem value="PAID">پرداخت‌شده</SelectItem>
            <SelectItem value="REJECTED">ردشده</SelectItem>
            <SelectItem value="CANCELLED">لغوشده</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} درخواست</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.settlements.map((s) => (
                  <div key={s.id} className="flex flex-col gap-2 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{formatToman(s.amount)}</span>
                        <StatusBadge status={s.status} />
                        <span className="text-sm">{s.applicant}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">{s.applicantMobile}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        کد پیگیری: <span className="font-mono" dir="ltr">{s.trackingCode}</span> · {faDateTime(s.createdAt)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {s.bankAccountName} · کارت <span dir="ltr" className="font-mono">{maskCard(s.bankCardNumber)}</span> · شبا <span dir="ltr" className="font-mono">{maskSheba(s.bankSheba)}</span>
                      </div>
                      {s.paymentTrackingCode ? <div className="mt-0.5 text-xs text-emerald-700">کد پیگیری پرداخت: <span dir="ltr" className="font-mono">{s.paymentTrackingCode}</span>{s.paidAt ? ` · ${faDateTime(s.paidAt)}` : ""}</div> : null}
                      {s.reviewNote ? <div className="mt-0.5 text-xs text-muted-foreground">توضیح: {s.reviewNote}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.status === "PENDING" ? (
                        <>
                          <Button size="sm" onClick={() => act({ action: "review", settlementId: s.id, decision: "APPROVE" }, "درخواست تأیید شد")}>تأیید</Button>
                          <Button size="sm" variant="destructive" onClick={() => { setReason(""); setDialog({ mode: "reject", item: s }) }}>رد</Button>
                        </>
                      ) : null}
                      {s.status === "APPROVED" ? (
                        <Button size="sm" disabled={!isSuper} title={isSuper ? "" : "فقط مدیر ارشد"} onClick={() => { setPayTracking(""); setDialog({ mode: "paid", item: s }) }}>
                          {isSuper ? "ثبت پرداخت‌شده" : "ثبت پرداخت (ویژه مدیر ارشد)"}
                        </Button>
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
                <DialogTitle>{dialog.mode === "reject" ? "رد درخواست تسویه" : "ثبت پرداخت تسویه"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/60 p-3 text-xs">
                  {dialog.item.applicant} · {formatToman(dialog.item.amount)} · <span className="font-mono" dir="ltr">{dialog.item.trackingCode}</span>
                </div>
                {dialog.mode === "reject" ? (
                  <>
                    <p className="text-xs text-muted-foreground">با رد درخواست، مبلغ نگه‌داشته‌شده به مانده قابل برداشت متقاضی بازمی‌گردد.</p>
                    <div className="space-y-1.5">
                      <Label>دلیل رد (الزامی)</Label>
                      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </div>
                    <Button variant="destructive" className="w-full" disabled={reason.trim().length < 3} onClick={() => act({ action: "review", settlementId: dialog.item.id, decision: "REJECT", note: reason }, "درخواست رد و مبلغ آزاد شد")}>
                      ثبت رد
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                      با ثبت «پرداخت‌شده»، مبلغ از نگهداشت خارج و پورسانت‌های تأییدشده این شخص (به‌ترتیب قدیمی) به‌عنوان تسویه‌شده علامت می‌خورند. این ثبت صرفاً گزارش پرداخت خارج از سامانه است و انتقال وجهی انجام نمی‌دهد (BR-20).
                    </p>
                    <div className="space-y-1.5">
                      <Label>کد پیگیری/رسید پرداخت *</Label>
                      <Input dir="ltr" value={payTracking} onChange={(e) => setPayTracking(e.target.value)} className="text-left" />
                    </div>
                    <Button
                      className="w-full"
                      disabled={payTracking.trim().length < 3}
                      onClick={() => act({ action: "mark_paid", settlementId: dialog.item.id, paymentTrackingCode: payTracking }, "پرداخت تسویه ثبت شد")}
                    >
                      ثبت پرداخت‌شده
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
