"use client"

// مودال «آمار و بررسی» — دکمهٔ عملیات در صفحهٔ پزشکان ادمین (ADMIN-007 · REPORT-004)
// شامل بازهٔ زمانی شمسی، ۶ کارت آماری، تفکیک وضعیت‌ها و روند روزانه
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errMessage } from "@/lib/client"
import { formatNumber, formatToman } from "@/lib/format"
import { JALALI_MONTHS, toFaDigits } from "@/lib/jalali"
import { toast } from "@/hooks/use-toast"
import {
  JalaliDateInput,
  dateToJalali,
  formatJalaliNumeric,
  isoToJalali,
  jalaliToDate,
  toIsoDate,
  type JalaliDate,
} from "./jalali-date-input"
import { BadgePercent, CheckCircle2, ClipboardList, Hourglass, RotateCw, Users, XCircle } from "lucide-react"

export interface DoctorStatsTarget {
  id: string
  name: string
  specialty: string
}

interface StatsResponse {
  doctor: { id: string; name: string; specialty: string }
  from: string
  to: string
  totals: {
    visits: number
    patients: number
    completed: number
    pending: number
    cancelled: number
    discount: number
  }
  byStatus: { status: string; count: number }[]
  daily: { date: string; count: number }[]
}

function currentMonthRange(): { from: JalaliDate; to: JalaliDate } {
  const today = dateToJalali(new Date())
  return { from: { jy: today.jy, jm: today.jm, jd: 1 }, to: today }
}

export function DoctorStatsModal({
  doctor,
  onClose,
}: {
  doctor: DoctorStatsTarget | null
  onClose: () => void
}) {
  const [range, setRange] = useState<{ from: JalaliDate; to: JalaliDate }>(currentMonthRange)
  const [applied, setApplied] = useState<{ from: JalaliDate; to: JalaliDate }>(currentMonthRange)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const appliedKey = doctor ? `${doctor.id}|${toIsoDate(applied.from)}|${toIsoDate(applied.to)}` : ""

  // با هر بار باز شدن مودال برای پزشک جدید، بازه به ماه جاری بازمی‌گردد
  useEffect(() => {
    if (doctor) {
      const r = currentMonthRange()
      setRange(r)
      setApplied(r)
      setStats(null)
    }
  }, [doctor?.id])

  const load = useCallback(async () => {
    if (!doctor) return
    setLoading(true)
    try {
      const d = await api.get<StatsResponse>(
        `/api/v1/admin/doctors/stats?doctorId=${encodeURIComponent(doctor.id)}&from=${toIsoDate(applied.from)}&to=${toIsoDate(applied.to)}`
      )
      setStats(d)
    } catch (e) {
      toast({ title: "خطا در دریافت آمار", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [appliedKey])

  useEffect(() => {
    if (doctor) load()
  }, [appliedKey])

  function refresh() {
    if (jalaliToDate(range.from) > jalaliToDate(range.to)) {
      toast({ title: "بازهٔ زمانی نامعتبر است", description: "تاریخ شروع باید قبل از تاریخ پایان باشد.", variant: "destructive" })
      return
    }
    setApplied({ from: range.from, to: range.to })
  }

  const maxDaily = stats ? Math.max(1, ...stats.daily.map((d) => d.count)) : 1

  return (
    <Dialog open={!!doctor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {doctor ? (
          <>
            <DialogHeader>
              <DialogTitle>آمار و بررسی ویزیت‌ها</DialogTitle>
              <DialogDescription>
                دکتر {doctor.name}
                {doctor.specialty ? ` · ${doctor.specialty}` : ""}
              </DialogDescription>
            </DialogHeader>

            {/* بازهٔ زمانی + دکمهٔ بهروزرسانی (مطابق الگوی گزارش‌ها) */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <span className="block text-xs text-muted-foreground">از تاریخ</span>
                <JalaliDateInput
                  aria-label="تاریخ شروع"
                  value={range.from}
                  onChange={(from) => setRange((r) => ({ ...r, from }))}
                />
              </div>
              <div className="space-y-1">
                <span className="block text-xs text-muted-foreground">تا تاریخ</span>
                <JalaliDateInput
                  aria-label="تاریخ پایان"
                  value={range.to}
                  onChange={(to) => setRange((r) => ({ ...r, to }))}
                />
              </div>
              <Button onClick={refresh} disabled={loading}>
                <RotateCw className={loading ? "size-4 animate-spin" : "size-4"} />
                بهروزرسانی
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              گزارش از {formatJalaliNumeric(applied.from)} تا {formatJalaliNumeric(applied.to)}
            </p>

            {/* کارت‌های آماری */}
            {loading && !stats ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard title="کل ویزیت‌ها" value={formatNumber(stats.totals.visits)} icon={<ClipboardList className="size-4" />} tone="sky" />
                <StatCard title="بیماران حامی‌کارت" value={formatNumber(stats.totals.patients)} hint="بیماران یکتای دارای ویزیت در بازه" icon={<Users className="size-4" />} tone="emerald" />
                <StatCard title="ویزیت‌های تکمیل‌شده" value={formatNumber(stats.totals.completed)} icon={<CheckCircle2 className="size-4" />} tone="emerald" />
                <StatCard title="در انتظار" value={formatNumber(stats.totals.pending)} icon={<Hourglass className="size-4" />} tone="amber" />
                <StatCard title="لغو/ردشده" value={formatNumber(stats.totals.cancelled)} icon={<XCircle className="size-4" />} tone="rose" />
                <StatCard title="تخفیف کل" value={formatToman(stats.totals.discount)} icon={<BadgePercent className="size-4" />} tone="violet" />
              </div>
            ) : null}

            {/* وضعیت‌ها */}
            {stats ? (
              <div className="rounded-lg border p-3">
                <h3 className="mb-2 text-sm font-semibold">وضعیت‌ها</h3>
                {stats.byStatus.length === 0 ? (
                  <p className="text-xs text-muted-foreground">در این بازه ویزیتی ثبت نشده است.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {stats.byStatus.map((s) => (
                      <span key={s.status} className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1">
                        <StatusBadge status={s.status} />
                        <span className="text-xs font-bold tabular-nums">{formatNumber(s.count)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* روند روزانه */}
            {stats ? (
              <div className="rounded-lg border p-3">
                <h3 className="mb-3 text-sm font-semibold">روند روزانه</h3>
                {stats.daily.length === 0 ? (
                  <p className="text-xs text-muted-foreground">رودی برای نمایش وجود ندارد.</p>
                ) : (
                  <div className="flex items-end gap-1.5 overflow-x-auto pb-1" dir="rtl">
                    {stats.daily.map((d, i) => {
                      const j = isoToJalali(d.date)
                      const height = Math.max(6, Math.round((d.count / maxDaily) * 96))
                      return (
                        <div
                          key={d.date}
                          className="flex min-w-8 flex-1 flex-col items-center gap-1"
                          title={`${formatJalaliNumeric(j)} — ${formatNumber(d.count)} ویزیت`}
                        >
                          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{toFaDigits(d.count)}</span>
                          <div className="w-full max-w-8 rounded-t-md bg-primary/80" style={{ height }} />
                          <span className="text-[10px] text-muted-foreground tabular-nums">{toFaDigits(j.jd)}</span>
                          {i === 0 || j.jd === 1 ? (
                            <span className="text-[9px] whitespace-nowrap text-muted-foreground">{JALALI_MONTHS[j.jm - 1]}</span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
