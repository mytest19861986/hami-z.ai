"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { api } from "@/lib/client"
import { faDate, daysUntil, toFaDigits } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { IdCard } from "lucide-react"

interface MembershipItem {
  id: string
  planTitle: string
  holder: string
  originType: string
  startDate: string
  endDate: string
  status: string
  usageLimit: number | null
  usedCount: number
  remaining: number | null
}

export default function MembershipsPage() {
  const [items, setItems] = useState<MembershipItem[] | null>(null)

  useEffect(() => {
    api.get<MembershipItem[]>("/api/v1/user/memberships").then(setItems).catch(() => setItems([]))
  }, [])

  return (
    <div>
      <PageHeader title="طرح‌ها و عضویت‌ها" description="سوابق کامل عضویت‌های فعال، منقضی و لغوشده (PLAN-013)" />
      {!items ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground"><IdCard className="mx-auto mb-3 h-10 w-10" />عضویتی ثبت نشده است.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const days = daysUntil(m.endDate)
            return (
              <Card key={m.id}>
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{m.planTitle}</span>
                      <StatusBadge status={m.status === "ACTIVE" && days < 0 ? "EXPIRED" : m.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      دارنده: {m.holder} · منشأ: {label(m.originType)} · از {faDate(m.startDate)} تا {faDate(m.endDate)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm sm:w-64">
                    <div className="rounded-lg bg-muted/60 p-2">
                      <div className="text-[10px] text-muted-foreground">باقی‌مانده</div>
                      <div className="font-bold">{m.usageLimit === null ? "نامحدود" : toFaDigits(m.remaining ?? 0)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-2">
                      <div className="text-[10px] text-muted-foreground">استفاده</div>
                      <div className="font-bold">{toFaDigits(m.usedCount)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-2">
                      <div className="text-[10px] text-muted-foreground">روز اعتبار</div>
                      <div className="font-bold">{toFaDigits(Math.max(0, days))}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
