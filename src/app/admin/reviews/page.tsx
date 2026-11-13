"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { faDateTime } from "@/lib/jalali"
import { Star } from "lucide-react"

interface ReviewRow {
  id: string
  doctor: string
  specialty: string
  author: string
  rating: number
  comment: string | null
  status: string
  createdAt: string
}

interface ReviewsResponse {
  total: number
  page: number
  totalPages: number
  reviews: ReviewRow[]
}

export default function AdminReviewsPage() {
  const [data, setData] = useState<ReviewsResponse | null>(null)
  const [status, setStatus] = useState("PENDING")
  const [page, setPage] = useState(1)

  useEffect(() => {
    let mounted = true
    api
      .get<ReviewsResponse>(`/api/v1/admin/reviews?status=${status}&page=${page}`)
      .then((d) => {
        if (mounted) setData(d)
      })
      .catch((e) => {
        if (mounted) toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
      })
    return () => {
      mounted = false
    }
  }, [status, page])

  async function act(id: string, decision: "APPROVE" | "REJECT") {
    try {
      await api.post("/api/v1/admin/reviews", { reviewId: id, decision, reason: decision === "REJECT" ? "عدم انطباق با قواعد انتشار" : "" })
      toast({ title: decision === "APPROVE" ? "نظر تأیید و منتشر شد" : "نظر رد شد" })
      api.get<ReviewsResponse>(`/api/v1/admin/reviews?status=${status}&page=${page}`).then(setData).catch(() => {})
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  const STATUS_TABS: { key: string; label: string }[] = [
    { key: "PENDING", label: "در انتظار" },
    { key: "APPROVED", label: "تأییدشده" },
    { key: "REJECTED", label: "ردشده" },
    { key: "", label: "همه" },
  ]

  return (
    <div>
      <PageHeader title="نظرات پزشکان" description="تأیید یا رد نظرات — تصمیم‌ها هر زمان که بخواهید قابل تغییر هستند؛ نظر تأییدشده منتشر می‌شود (REVIEW-003/004)" />
      {!data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            {STATUS_TABS.map((s) => (
              <Button key={s.key || "ALL"} size="sm" variant={status === s.key ? "default" : "outline"} onClick={() => { setPage(1); setStatus(s.key) }}>
                {s.label}
              </Button>
            ))}
          </div>
          {data.reviews.length === 0 ? (
            <EmptyState title={status === "PENDING" ? "نظری در انتظار بررسی نیست" : "نظری یافت نشد"} />
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {data.reviews.map((r) => (
                      <div key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">دکتر {r.doctor}</span>
                            <StatusBadge status={r.status} />
                            <span className="flex items-center gap-0.5 text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400" : "text-muted-foreground"}`} />
                              ))}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">نویسنده: {r.author} · {faDateTime(r.createdAt)}</div>
                          {r.comment ? <p className="mt-1 text-sm leading-6">{r.comment}</p> : null}
                        </div>
                        {/* تصمیم در هر وضعیتی قابل تغییر است (REVIEW-004): تأیید/انتشار مجدد یا رد/لغو انتشار */}
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant={r.status === "APPROVED" ? "outline" : "default"} onClick={() => act(r.id, "APPROVE")}>
                            {r.status === "APPROVED" ? "منتشر شده — نگه‌داشتن" : "تأیید و انتشار"}
                          </Button>
                          <Button size="sm" variant={r.status === "REJECTED" ? "outline" : "destructive"} onClick={() => act(r.id, "REJECT")}>
                            {r.status === "REJECTED" ? "ردشده — نگه‌داشتن" : "رد"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </>
          )}
        </>
      )}
    </div>
  )
}
