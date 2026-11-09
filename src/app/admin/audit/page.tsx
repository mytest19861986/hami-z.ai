"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { faDateTime } from "@/lib/jalali"
import { toFaDigits } from "@/lib/jalali"
import { Search } from "lucide-react"

interface AuditRow {
  id: string
  actorName: string | null
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

interface AuditResponse {
  total: number
  page: number
  totalPages: number
  logs: AuditRow[]
}

export default function AdminAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")

  const requestKey = JSON.stringify([q, page])
  const loading = requestKey !== loadedKey

  useEffect(() => {
    let mounted = true
    api
      .get<AuditResponse>(`/api/v1/admin/audit?q=${encodeURIComponent(q)}&page=${page}`)
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
      <PageHeader title="رخدادهای سیستم" description="سوابق قابل ممیزی اقدامات حساس (ADMIN-025 · SEC-006)" />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="جست‌وجو در اقدام یا عامل…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
        </div>
      </div>

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data && data.logs.length === 0 ? (
        <EmptyState title="رخدادی ثبت نشده است" />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{toFaDigits(data.total)} رخداد</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.logs.map((l) => (
                  <div key={l.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold" dir="ltr">{l.action}</span>
                      <span className="text-xs text-muted-foreground">{l.actorName ?? "سیستم"} · {faDateTime(l.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5">{l.entityType}</span>
                      {l.entityId ? <span className="font-mono" dir="ltr">{l.entityId.slice(0, 12)}…</span> : null}
                    </div>
                    {l.details ? (
                      <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-muted/60 p-2 text-[11px] leading-5" dir="ltr">
                        {JSON.stringify(l.details, null, 1)}
                      </pre>
                    ) : null}
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
