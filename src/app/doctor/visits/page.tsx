"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Pagination } from "@/components/shared/pagination"
import { api, errMessage } from "@/lib/client"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"
import { label } from "@/constants/labels"

interface VisitItem {
  id: string
  holder: string
  planTitle: string
  visitDate: string
  totalAmount: number
  discountPercent: number
  discountBase: string
  discountAmount: number
  finalAmount: number
  status: string
  note: string | null
}

interface VisitsResponse {
  total: number
  page: number
  totalPages: number
  visits: VisitItem[]
}

export default function DoctorVisitsPage() {
  const [data, setData] = useState<VisitsResponse | null>(null)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    let mounted = true
    api
      .get<VisitsResponse>(`/api/v1/doctor/visits?page=${page}`)
      .then((d) => {
        if (mounted) setData(d)
      })
      .catch((e) => {
        if (mounted) setError(errMessage(e))
      })
    return () => {
      mounted = false
    }
  }, [page])

  return (
    <div>
      <PageHeader title="تاریخچه ویزیت‌ها" description="ویزیت‌های ثبت‌شده توسط شما (DOCTOR-DASH-005 · VISIT-011)" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data.visits.length === 0 ? (
        <EmptyState title="ویزیتی ثبت نشده است" description="از صفحه «احراز شرایط و ثبت ویزیت» اولین ویزیت را ثبت کنید." />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} ویزیت</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.visits.map((v) => (
                  <div key={v.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{v.holder}</span>
                        <StatusBadge status={v.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {v.planTitle} · {faDateTime(v.visitDate)} · تخفیف {v.discountPercent}٪ ({label(v.discountBase)})
                      </div>
                      {v.note ? <div className="mt-1 text-xs text-muted-foreground">یادداشت: {v.note}</div> : null}
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
      )}
    </div>
  )
}
