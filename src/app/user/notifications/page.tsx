"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { api } from "@/lib/client"
import { faDateTime } from "@/lib/jalali"
import { cn } from "@/lib/utils"
import { CheckCheck } from "lucide-react"

interface Notice {
  id: string
  title: string
  body: string | null
  type: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[] | null>(null)

  useEffect(() => {
    api.get<{ items: Notice[] }>("/api/v1/user/notifications").then((d) => setItems(d.items)).catch(() => setItems([]))
  }, [])

  async function markAll() {
    await api.post("/api/v1/user/notifications", { all: true }).catch(() => {})
    setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? null)
  }

  return (
    <div>
      <PageHeader
        title="اعلان‌ها"
        description="رخدادهای مهم حساب شما (NOTICE-001)"
        action={items && items.some((n) => !n.isRead) ? <Button variant="outline" onClick={markAll}><CheckCheck className="ml-1 h-4 w-4" />خواندن همه</Button> : undefined}
      />
      {!items ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState title="اعلانی ندارید" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((n) => (
                <div key={n.id} className={cn("p-4", !n.isRead && "bg-primary/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm font-medium", !n.isRead && "text-primary")}>{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{faDateTime(n.createdAt)}</span>
                  </div>
                  {n.body ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{n.body}</p> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
