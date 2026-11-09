"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { Search } from "lucide-react"

interface VisitRow {
  id: string
  holder: string
  holderNationalCode: string | null
  doctor: string
  specialty: string
  planTitle: string
  visitDate: string
  totalAmount: number
  discountPercent: number
  discountBase: string
  discountAmount: number
  finalAmount: number
  status: string
}

interface VisitsResponse {
  total: number
  page: number
  totalPages: number
  totals: { discount: number; final: number }
  visits: VisitRow[]
}

export default function AdminVisitsPage() {
  const [data, setData] = useState<VisitsResponse | null>(null)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")

  const requestKey = JSON.stringify([q, status, page])
  const loading = requestKey !== loadedKey

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    params.set("page", String(page))
    api
      .get<VisitsResponse>(`/api/v1/admin/visits?${params.toString()}`)
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

  return (
    <div>
      <PageHeader title="ویزیت‌ها" description="همه ویزیت‌های ثبت‌شده با مبانی تخفیف شفاف (REPORT-004)" />

      {data ? (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard title="تعداد ویزیت (فیلترشده)" value={data.total} />
          <StatCard title="مجموع تخفیف ارائه‌شده" value={formatToman(data.totals.discount)} tone="emerald" />
          <StatCard title="مجموع پرداختی دارندگان" value={formatToman(data.totals.final)} tone="sky" />
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="دارنده یا پزشک…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
        </div>
        <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="COMPLETED">تکمیل‌شده</SelectItem>
            <SelectItem value="CANCELLED">لغوشده</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data && data.visits.length === 0 ? (
        <EmptyState title="ویزیتی یافت نشد" />
      ) : data ? (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.visits.map((v) => (
                  <div key={v.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{v.holder}</span>
                        <StatusBadge status={v.status} />
                        <span className="text-xs text-muted-foreground">دکتر {v.doctor} — {v.specialty}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {v.planTitle} · {faDateTime(v.visitDate)} · تخفیف {v.discountPercent}٪ ({label(v.discountBase)})
                      </div>
                    </div>
                    <div className="text-sm sm:text-left">
                      <div className="font-bold text-emerald-700">{formatToman(v.discountAmount)} تخفیف</div>
                      <div className="text-xs text-muted-foreground">از {formatToman(v.totalAmount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      ) : null}
    </div>
  )
}
