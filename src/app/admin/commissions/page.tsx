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
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman, formatPercent } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { COMMISSION_TYPE_LABELS } from "@/constants/labels"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CommissionRow {
  id: string
  type: string
  beneficiary: string
  beneficiaryMobile: string
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
  const [status, setStatus] = useState("PENDING")
  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [rejectItem, setRejectItem] = useState<CommissionRow | null>(null)
  const [reason, setReason] = useState("")

  const requestKey = JSON.stringify([q, status, type, page])
  const loading = requestKey !== loadedKey

  function fetchUrl() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    if (type) params.set("type", type)
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
      <PageHeader title="پورسانت‌ها" description="تأیید/رد پورسانت فروش و معرفی — تأیید به معنی افزایش اتمیک مانده قابل برداشت است (ADMIN-017/018 · REF-006)" />

      {data ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.byStatus.map((s) => (
            <Card key={s.status} className={status === s.status ? "border-primary ring-1 ring-primary/30" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={s.status} />
                  <span className="text-xs text-muted-foreground">{s.count} مورد</span>
                </div>
                <div className="mt-2 text-lg font-bold">{formatToman(s.total)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
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
