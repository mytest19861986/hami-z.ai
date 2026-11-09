"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { api } from "@/lib/client"
import { faDate } from "@/lib/jalali"
import { formatToman } from "@/lib/format"
import { ClipboardPlus, Stethoscope, Users, Clock, CheckCircle2, Hourglass, XCircle } from "lucide-react"

interface DoctorStatus {
  id: string
  specialty: string
  clinicName: string | null
  province: string | null
  city: string | null
  discountPercent: number | null
  status: string
  rejectReason: string | null
  reviewedAt: string | null
  visitsCount: number
}

export default function DoctorDashboard() {
  const [status, setStatus] = useState<DoctorStatus | null | "none" | "loading">("loading")

  useEffect(() => {
    let mounted = true
    api
      .get<DoctorStatus | null>("/api/v1/doctor/status")
      .then((d) => {
        if (mounted) setStatus(d ?? "none")
      })
      .catch(() => {
        if (mounted) setStatus("none")
      })
    return () => {
      mounted = false
    }
  }, [])

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  // پزشک هنوز درخواست نداده (DOC-007)
  if (status === "none") {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="p-8 text-center">
            <Stethoscope className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-lg font-bold">درخواست همکاری پزشکی ثبت نشده است</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              برای استفاده از داشبورد پزشک و ثبت ویزیت، ابتدا اطلاعات حرفه‌ای خود را ثبت و در انتظار تأیید مدیر بمانید.
            </p>
            <Button asChild className="mt-5">
              <Link href="/doctor/register">ثبت درخواست همکاری</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const s = status

  // پزشک در انتظار تأیید یا ردشده — فقط وضعیت و راهنما (DOCTOR-DASH-002 · BR-02)
  if (s.status !== "APPROVED") {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="p-8 text-center">
            {s.status === "PENDING" || s.status === "UNDER_REVIEW" ? (
              <Hourglass className="mx-auto h-12 w-12 text-amber-500" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-rose-500" />
            )}
            <h1 className="mt-4 text-lg font-bold">
              {s.status === "PENDING" ? "درخواست شما در انتظار بررسی است" : s.status === "UNDER_REVIEW" ? "درخواست شما در حال بررسی است" : s.status === "REJECTED" ? "درخواست شما رد شده است" : "همکاری شما تعلیق شده است"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {s.status === "PENDING" || s.status === "UNDER_REVIEW"
                ? "تا زمان تأیید مدیر، داشبورد عملیاتی پزشک و ثبت ویزیت فعال نیست."
                : s.rejectReason ?? "برای پیگیری با پشتیبانی تماس بگیرید."}
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/doctor/register">مشاهده و ویرایش مشخصات</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // داشبورد عملیاتی پزشک تأییدشده (DOCTOR-DASH-001)
  return (
    <div>
      <PageHeader
        title="داشبورد پزشک"
        description={`تخصص: ${s.specialty} · ${s.clinicName ?? ""}`}
        action={
          <Button asChild>
            <Link href="/doctor/visits/new">
              <ClipboardPlus className="ml-1 h-4 w-4" />
              ثبت ویزیت جدید
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="ویزیت‌های ثبت‌شده" value={s.visitsCount} icon={<ClipboardPlus className="h-4 w-4" />} />
        <StatCard title="درصد تخفیف شما" value={s.discountPercent ? `${s.discountPercent}٪ (اختصاصی)` : "طبق درصد طرح"} tone="emerald" icon={<Users className="h-4 w-4" />} />
        <StatCard title="وضعیت همکاری" value={<StatusBadge status={s.status} />} tone="sky" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard title="منطقه فعالیت" value={`${s.province ?? "—"} / ${s.city ?? "—"}`} tone="violet" icon={<Clock className="h-4 w-4" />} />
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h2 className="font-semibold">راهنمای ثبت ویزیت</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>۱. کد ملی دارنده طرح را در صفحه «احراز شرایط» وارد کنید.</li>
            <li>۲. عضویت فعال و سهمیه باقی‌مانده او را بررسی کنید.</li>
            <li>۳. مبلغ ویزیت را وارد و ویزیت را ثبت کنید؛ تخفیف به‌صورت خودکار محاسبه و سهمیه یک‌بار مصرف می‌شود.</li>
            <li>۴. مبنای تخفیف: {s.discountPercent ? `درصد اختصاصی شما (${s.discountPercent}٪)` : "درصد طرح دارنده"}.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">آخرین بررسی وضعیت: {s.reviewedAt ? faDate(s.reviewedAt) : "—"} · ثبت تاریخ آینده ممکن نیست (VISIT-004).</p>
        </CardContent>
      </Card>
    </div>
  )
}
