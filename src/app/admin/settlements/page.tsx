"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { faDateTime, toFaDigits } from "@/lib/jalali"
import { maskCard, maskSheba } from "@/lib/validators"
import { Search, Copy, Check, FileSpreadsheet, FileText } from "lucide-react"

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

/* ─── کپی شماره کارت/شبا با نمایش ماسک‌شده (EXPORT-SETTLE) ───
   مقدار کامل (که از API آمده) کلیپ‌بورد می‌شود؛ نمایش روی صفحه ماسک می‌ماند. */
function CopyField({ value, label, masked }: { value: string; label: string; masked: string }) {
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        throw new Error("clipboard unavailable")
      }
    } catch {
      // جایگزین برای زمینه‌های غیرامن (http) یا مرورگرهای قدیمی
      const ta = document.createElement("textarea")
      ta.value = value
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand("copy")
      } catch {}
      document.body.removeChild(ta)
    }
    setDone(true)
    toast({ title: `${label} کپی شد`, description: value })
    setTimeout(() => setDone(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`کپی ${label}`}
      className="group inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:border-border hover:bg-muted"
    >
      <span dir="ltr">{masked}</span>
      {done ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  )
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
  // انتخاب تسویه‌های تأییدشده برای خروجی (بین صفحات حفظ می‌شود)
  const [selected, setSelected] = useState<Map<string, SettlementRow>>(new Map())
  const [exporting, setExporting] = useState(false)

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

  /* ─── انتخاب ردیف‌ها ─── */
  const approvedOnPage = (data?.settlements ?? []).filter((s) => s.status === "APPROVED")
  const selectedTotal = [...selected.values()].reduce((a, b) => a + b.amount, 0)
  const allApprovedOnPageSelected = approvedOnPage.length > 0 && approvedOnPage.every((s) => selected.has(s.id))

  function toggleOne(s: SettlementRow, on: boolean) {
    setSelected((prev) => {
      const n = new Map(prev)
      if (on) n.set(s.id, s)
      else n.delete(s.id)
      return n
    })
  }

  function toggleAllOnPage(on: boolean) {
    setSelected((prev) => {
      const n = new Map(prev)
      for (const s of approvedOnPage) {
        if (on) n.set(s.id, s)
        else n.delete(s.id)
      }
      return n
    })
  }

  /* ─── خروجی اکسل (فایل xlsx از سرور) ─── */
  async function exportXlsx() {
    if (selected.size === 0 || exporting) return
    setExporting(true)
    try {
      const res = await fetch("/api/v1/admin/settlements/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
        body: JSON.stringify({ ids: [...selected.keys()] }),
      })
      if (!res.ok) {
        let msg = "خطا در ساخت خروجی اکسل."
        try {
          const j = (await res.json()) as { error?: string }
          if (j?.error) msg = j.error
        } catch {}
        throw new Error(msg)
      }
      const count = Number(res.headers.get("X-Export-Count") ?? "0")
      const blob = await res.blob()
      const cd = res.headers.get("Content-Disposition") ?? ""
      const m = /filename="([^"]+)"/.exec(cd)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = m?.[1] ?? "settlements.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({
        title: "خروجی اکسل آماده شد",
        description:
          count === selected.size
            ? `${toFaDigits(count)} تسویهٔ تأییدشده · جمع ${formatToman(selectedTotal)}`
            : `${toFaDigits(count)} مورد از ${toFaDigits(selected.size)} انتخابی — فقط ردیف‌های تأییدشده خروجی می‌شوند.`,
      })
    } catch (e) {
      toast({ title: "خطا", description: e instanceof Error ? e.message : errMessage(e), variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  /* ─── خروجی PDF (صفحهٔ چاپ اختصاصی → Save as PDF مرورگر) ─── */
  function exportPdf() {
    if (selected.size === 0) return
    const ids = encodeURIComponent([...selected.keys()].join(","))
    const w = window.open(`/print/settlements?ids=${ids}`, "_blank")
    if (!w) {
      toast({
        title: "پنجرهٔ چاپ باز نشد",
        description: "مجوز پنجره‌های بازشدنی (Popup) مرورگر را برای این سایت فعال کنید.",
        variant: "destructive",
      })
    }
  }

  async function act(body: Record<string, unknown>, msg: string) {
    try {
      await api.post("/api/v1/admin/settlements", body)
      toast({ title: msg })
      setDialog(null)
      setReason("")
      setPayTracking("")
      // با «پرداخت‌شده» ثبت‌شدن، ردیف دیگر تأییدشده نیست → از انتخاب خروجی حذف شود
      if (body.action === "mark_paid" && typeof body.settlementId === "string") {
        const sid = body.settlementId
        setSelected((prev) => {
          const n = new Map(prev)
          n.delete(sid)
          return n
        })
      }
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

      {/* نوار خروجی — انتخاب تسویه‌های تأییدشده برای اکسل/PDF (EXPORT-SETTLE) */}
      {!loading && (approvedOnPage.length > 0 || selected.size > 0) ? (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium">
            <Checkbox
              checked={allApprovedOnPageSelected}
              onCheckedChange={(c) => toggleAllOnPage(c === true)}
              disabled={approvedOnPage.length === 0}
              aria-label="انتخاب همهٔ تأییدشده‌های این صفحه"
            />
            انتخاب همهٔ تأییدشده‌های این صفحه
          </label>
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${toFaDigits(selected.size)} مورد انتخاب شد · جمع ${formatToman(selectedTotal)}`
              : "برای خروجی اکسل/PDF، ردیف‌های تأییدشده را انتخاب کنید"}
          </span>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={selected.size === 0 || exporting} onClick={exportXlsx}>
              <FileSpreadsheet className="ml-1 h-4 w-4" />
              {exporting ? "در حال ساخت…" : "خروجی اکسل"}
            </Button>
            <Button size="sm" variant="outline" disabled={selected.size === 0} onClick={exportPdf}>
              <FileText className="ml-1 h-4 w-4" />
              خروجی PDF (چاپ)
            </Button>
            {selected.size > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Map())}>
                لغو انتخاب
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} درخواست</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.settlements.map((s) => (
                  <div
                    key={s.id}
                    className={`flex flex-col gap-2 p-4 lg:flex-row lg:items-center lg:justify-between ${selected.has(s.id) ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex flex-1 items-start gap-3">
                      {s.status === "APPROVED" ? (
                        <Checkbox
                          checked={selected.has(s.id)}
                          onCheckedChange={(c) => toggleOne(s, c === true)}
                          aria-label={`انتخاب ${s.applicant} برای خروجی`}
                          className="mt-1"
                        />
                      ) : null}
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
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{s.bankAccountName}</span>
                          <span className="text-border">·</span>
                          <CopyField value={s.bankCardNumber} label="شماره کارت" masked={maskCard(s.bankCardNumber)} />
                          <span className="text-border">·</span>
                          <CopyField value={s.bankSheba} label="شماره شبا" masked={maskSheba(s.bankSheba)} />
                        </div>
                        {s.paymentTrackingCode ? <div className="mt-0.5 text-xs text-emerald-700">کد پیگیری پرداخت: <span dir="ltr" className="font-mono">{s.paymentTrackingCode}</span>{s.paidAt ? ` · ${faDateTime(s.paidAt)}` : ""}</div> : null}
                        {s.reviewNote ? <div className="mt-0.5 text-xs text-muted-foreground">توضیح: {s.reviewNote}</div> : null}
                      </div>
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
