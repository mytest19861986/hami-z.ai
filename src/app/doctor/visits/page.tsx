"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Pagination } from "@/components/shared/pagination"
import { JalaliDateInput, type JalaliDate, formatJalaliNumeric, toIsoDate } from "@/components/admin/jalali-date-input"
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
  // فیلتر بازه تاریخ شمسی (DOCTOR-DASH-005): هر دو تاریخ باید با هم اعمال شوند
  const [range, setRange] = useState<{ from: JalaliDate | null; to: JalaliDate | null }>({ from: null, to: null })

  const requestKey = JSON.stringify([page, range])

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    if (range.from && range.to) {
      params.set("from", toIsoDate(range.from))
      params.set("to", toIsoDate(range.to))
    }
    params.set("page", String(page))
    api
      .get<VisitsResponse>(`/api/v1/doctor/visits?${params.toString()}`)
      .then((d) => {
        if (mounted) setData(d)
      })
      .catch((e) => {
        if (mounted) setError(errMessage(e))
      })
    return () => {
      mounted = false
    }
  }, [requestKey])

  return (
    <div>
      <PageHeader title="تاریخچه ویزیت‌ها" description="ویزیت‌های ثبت‌شده توسط شما (DOCTOR-DASH-005 · VISIT-011)" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* نوار فیلتر بازه تاریخ شمسی (UX-002) */}
      <div className="mb-5 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">از تاریخ (شمسی)</span>
            <JalaliDateInput
              aria-label="تاریخ شروع بازه"
              value={range.from}
              onChange={(from) => { setPage(1); setRange((r) => ({ ...r, from })) }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">تا تاریخ (شمسی)</span>
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
              className="self-end sm:self-center"
              onClick={() => { setPage(1); setRange({ from: null, to: null }) }}
            >
              پاک‌کردن بازه
            </Button>
          )}
          <div className="text-xs text-muted-foreground sm:mr-auto">
            {range.from && range.to ? (
              `نمایش ویزیت‌های ${formatJalaliNumeric(range.from)} تا ${formatJalaliNumeric(range.to)}`
            ) : "بدون محدودیت تاریخ (هر دو تاریخ را انتخاب کنید تا بازه اعمال شود)"}
          </div>
        </div>
      </div>

      {!data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data.visits.length === 0 ? (
        <EmptyState
          title={range.from && range.to ? "ویزیتی در این بازه ثبت نشده است" : "ویزیتی ثبت نشده است"}
          description={
            range.from && range.to
              ? "بازه را تغییر دهید یا پاک کنید تا همهٔ ویزیت‌ها را ببینید."
              : "از صفحه «احراز شرایط و ثبت ویزیت» اولین ویزیت را ثبت کنید."
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {data.total} ویزیت{range.from && range.to ? " در بازهٔ انتخابی" : ""}
          </p>
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
