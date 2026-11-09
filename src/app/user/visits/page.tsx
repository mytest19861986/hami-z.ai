"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { api } from "@/lib/client"
import { formatToman } from "@/lib/format"
import { faDate } from "@/lib/jalali"

interface VisitItem {
  id: string
  holder: string
  doctorName: string
  specialty: string
  clinicName: string | null
  visitDate: string
  totalAmount: number
  discountPercent: number
  discountAmount: number
  finalAmount: number
  status: string
}

export default function UserVisitsPage() {
  const [items, setItems] = useState<VisitItem[] | null>(null)

  useEffect(() => {
    api.get<VisitItem[]>("/api/v1/user/visits").then(setItems).catch(() => setItems([]))
  }, [])

  return (
    <div>
      <PageHeader title="سوابق ویزیت" description="ویزیت‌ها و تخفیف‌های دریافتی دارندگان طرح شما (USER-005)" />
      {!items ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState title="ویزیتی ثبت نشده است" description="پس از تهیه طرح و مراجعه به پزشک طرف قرارداد، سوابق اینجا نمایش داده می‌شود." />
      ) : (
        <div className="space-y-3">
          {items.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">دکتر {v.doctorName}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {v.specialty}{v.clinicName ? ` · ${v.clinicName}` : ""} · دارنده: {v.holder} · {faDate(v.visitDate)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs sm:w-80">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <div className="text-muted-foreground">مبلغ ویزیت</div>
                    <div className="mt-0.5 font-bold">{formatToman(v.totalAmount)}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                    <div className="text-emerald-700">تخفیف ({v.discountPercent}٪)</div>
                    <div className="mt-0.5 font-bold">{formatToman(v.discountAmount)}</div>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2">
                    <div className="text-primary">پرداختی</div>
                    <div className="mt-0.5 font-bold text-primary">{formatToman(v.finalAmount)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
