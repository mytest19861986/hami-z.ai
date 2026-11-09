"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge, TypeBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { api } from "@/lib/client"
import { formatToman, formatPercent } from "@/lib/format"
import { faDate } from "@/lib/jalali"
import { COMMISSION_TYPE_LABELS, label } from "@/constants/labels"

interface CommissionItem {
  id: string
  type: string
  planTitle: string
  baseAmount: number
  percent: number
  amount: number
  status: string
  customer: string | null
  createdAt: string
  approvedAt: string | null
}

interface CommissionsData {
  items: CommissionItem[]
  byStatus: { status: string; total: number; count: number }[]
  pendingTotal: number
}

export default function AgentCommissionsPage() {
  const [data, setData] = useState<CommissionsData | null>(null)

  useEffect(() => {
    api.get<CommissionsData>("/api/v1/agent/commissions").then(setData).catch(() => setData({ items: [], byStatus: [], pendingTotal: 0 }))
  }, [])

  return (
    <div>
      <PageHeader title="پورسانت‌ها" description="ریز پورسانت‌های فروش و معرفی با تفکیک وضعیت (REF-010 · AGENT-DASH-006)" />
      {!data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.byStatus.map((s) => (
              <Card key={s.status}>
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

          {data.items.length === 0 ? (
            <EmptyState title="پورسانتی ثبت نشده است" description="با نهایی‌شدن فروش‌ها و تأیید مدیر، پورسانت‌ها اینجا نمایش داده می‌شوند." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {data.items.map((c) => (
                    <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <TypeBadge tone={c.type === "SALE" ? "emerald" : "violet"}>{COMMISSION_TYPE_LABELS[c.type] ?? c.type}</TypeBadge>
                          <StatusBadge status={c.status} />
                          <span className="text-sm font-medium">{c.planTitle}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.customer ? `مشتری: ${c.customer} · ` : ""}مبنا: {formatToman(c.baseAmount)} × {formatPercent(c.percent)} · {faDate(c.createdAt)}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-primary sm:text-left">{formatToman(c.amount)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
