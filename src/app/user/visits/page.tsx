"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { faDate, toFaDigits } from "@/lib/jalali"
import { Star } from "lucide-react"

interface ReviewInfo {
  rating: number
  comment: string | null
  status: string
}

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
  review: ReviewInfo | null
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار تأیید ادمین",
  APPROVED: "تأیید و منتشر شده",
  REJECTED: "رد شده",
}

/** نمایش ستاره‌های امتیاز (پر/خالی) */
function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="flex items-center gap-0.5 text-amber-500" aria-label={`${toFaDigits(value)} از ۵ ستاره`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${className} ${i < value ? "fill-amber-400" : "text-muted-foreground"}`} />
      ))}
    </span>
  )
}

export default function UserVisitsPage() {
  const [items, setItems] = useState<VisitItem[] | null>(null)
  // مودال ثبت نظر: کدام ویزیت + امتیاز انتخابی + متن نظر
  const [reviewFor, setReviewFor] = useState<VisitItem | null>(null)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<VisitItem[]>("/api/v1/user/visits").then(setItems).catch(() => setItems([]))
  }, [])

  async function submitReview() {
    if (!reviewFor || rating < 1) return
    setSaving(true)
    try {
      await api.post("/api/v1/user/visits", { visitId: reviewFor.id, rating, comment: comment.trim() || undefined })
      toast({ title: "نظر شما ثبت شد", description: "پس از تأیید مدیر منتشر خواهد شد." })
      setReviewFor(null)
      setRating(0)
      setHovered(0)
      setComment("")
      api.get<VisitItem[]>("/api/v1/user/visits").then(setItems).catch(() => {})
    } catch (e) {
      toast({ title: "خطا در ثبت نظر", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="سوابق ویزیت" description="ویزیت‌ها و تخفیف‌های دریافتی دارندگان طرح شما — پس از هر ویزیت می‌توانید امتیاز و نظر خود را ثبت کنید (USER-005)" />
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
                  {/* نظر ثبت‌شده برای این ویزیت */}
                  {v.review ? (
                    <div className="mt-2 rounded-lg border border-amber-200/70 bg-amber-50/60 p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars value={v.review.rating} className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium text-amber-800">{REVIEW_STATUS_LABELS[v.review.status] ?? v.review.status}</span>
                      </div>
                      {v.review.comment ? <p className="mt-1 text-xs leading-5 text-foreground/80">{v.review.comment}</p> : null}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => { setReviewFor(v); setRating(0); setHovered(0); setComment("") }}>
                      <Star className="ml-1 h-3.5 w-3.5" />
                      ثبت نظر و امتیاز
                    </Button>
                  )}
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

      {/* مودال ثبت نظر و امتیاز (REVIEW-001) */}
      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ثبت نظر و امتیاز</DialogTitle></DialogHeader>
          {reviewFor ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/60 p-3 text-xs">
                دکتر {reviewFor.doctorName} — {reviewFor.specialty} · {faDate(reviewFor.visitDate)}
              </div>

              {/* انتخاب ستاره ۱ تا ۵ با حالت hover */}
              <div className="space-y-1.5">
                <span className="block text-sm font-medium">امتیاز شما (الزامی)</span>
                <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const star = i + 1
                    const active = star <= (hovered || rating)
                    return (
                      <button
                        key={star}
                        type="button"
                        aria-label={`${toFaDigits(star)} ستاره`}
                        onMouseEnter={() => setHovered(star)}
                        onClick={() => setRating(star)}
                        className="rounded-md p-1 transition-transform hover:scale-110"
                      >
                        <Star className={`h-7 w-7 ${active ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
                      </button>
                    )
                  })}
                  <span className="mr-2 text-xs text-muted-foreground">
                    {rating > 0 ? `${toFaDigits(rating)} از ۵` : "روی ستاره‌ها بروید و انتخاب کنید"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-sm font-medium">نظر شما (اختیاری)</span>
                <Textarea
                  rows={4}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="تجربهٔ خود از این پزشک را بنویسید…"
                />
                <p className="text-xs text-muted-foreground">نظر پس از بررسی و تأیید مدیر منتشر می‌شود.</p>
              </div>

              <Button className="w-full" size="lg" disabled={saving || rating < 1} onClick={submitReview}>
                {saving ? "در حال ثبت…" : "ثبت نظر"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
