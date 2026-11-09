"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { api, errMessage } from "@/lib/client"
import { formatToman } from "@/lib/format"
import { faDateTime } from "@/lib/jalali"

interface PurchaseItem {
  id: string
  trackingCode: string
  planTitle: string
  holder: string
  amount: number
  status: string
  createdAt: string
  approvedAt: string | null
  rejectReason: string | null
}

export default function PurchasesPage() {
  const [items, setItems] = useState<PurchaseItem[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api.get<PurchaseItem[]>("/api/v1/user/purchases").then(setItems).catch((e) => setError(errMessage(e)))
  }, [])

  return (
    <div>
      <PageHeader
        title="سوابق خرید"
        description="وضعیت واقعی هر خرید با کد پیگیری قابل رهگیری است (PAY-008)."
        action={<Button asChild><Link href="/plans">خرید طرح جدید</Link></Button>}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!items ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState title="خریدی ثبت نشده است" description="از صفحه طرح‌ها، اولین عضویت خود را تهیه کنید." action={<Button asChild><Link href="/plans">مشاهده طرح‌ها</Link></Button>} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.planTitle}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      دارنده: {p.holder} · کد پیگیری: <span className="font-mono" dir="ltr">{p.trackingCode}</span> · {faDateTime(p.createdAt)}
                    </div>
                    {p.rejectReason ? <div className="mt-1 text-xs text-rose-600">دلیل رد: {p.rejectReason}</div> : null}
                  </div>
                  <div className="text-sm font-bold text-primary sm:text-left">{formatToman(p.amount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
