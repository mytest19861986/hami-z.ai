"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Barcode } from "@/components/shared/barcode"
import { BrandMark } from "@/components/shared/brand"
import { api } from "@/lib/client"
import { faDate, daysUntil, toFaDigits } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { CreditCard, Stethoscope, CalendarClock } from "lucide-react"

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
  planDiscountPercent?: number
  cardSerial: string | null
}

export default function UserCardPage() {
  const [items, setItems] = useState<MembershipItem[] | null>(null)

  useEffect(() => {
    api.get<MembershipItem[]>("/api/v1/user/memberships").then(setItems).catch(() => setItems([]))
  }, [])

  if (!items) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    )
  }

  const now = new Date()
  const active = items.filter((m) => m.status === "ACTIVE" && new Date(m.endDate) >= now)
  const past = items.filter((m) => !(m.status === "ACTIVE" && new Date(m.endDate) >= now))

  return (
    <div>
      <PageHeader
        title="کارت مجازی حامی‌کارت"
        description="کارت دیجیتال شما با سریال یکتا و بارکد — در مراجعه به پزشک طرف قرارداد، همین سریال را ارائه کنید (SURF-USER)."
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">هنوز عضویتی فعال ندارید.</p>
            <Button asChild className="mt-4">
              <Link href="/plans">مشاهده طرح‌ها</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {active.map((m) => {
          const days = daysUntil(m.endDate)
          return (
            <div key={m.id} className="space-y-3">
              {/* کارت فیزیکی‌نما */}
              <div className="relative overflow-hidden rounded-3xl bg-[#2a4494] p-6 text-[#f6f1e7] shadow-xl ring-1 ring-[#1d315f]" dir="rtl">
                {/* نقش شمسه پس‌زمینه */}
                <svg viewBox="0 0 200 200" className="pointer-events-none absolute -left-10 -top-16 h-64 w-64 opacity-[0.14]" aria-hidden="true">
                  <g stroke="#f6f1e7" strokeWidth="1.2" fill="none">
                    <rect x="56" y="56" width="88" height="88" />
                    <rect x="56" y="56" width="88" height="88" transform="rotate(45 100 100)" />
                    <rect x="38" y="38" width="124" height="124" />
                    <rect x="38" y="38" width="124" height="124" transform="rotate(45 100 100)" />
                  </g>
                </svg>

                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <BrandMark size={38} />
                    <div className="leading-tight">
                      <div className="font-display text-base font-bold">حامی‌کارت</div>
                      <div className="text-[10px] opacity-70">کارت تخفیف خدمات درمانی</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#d9942b] px-2.5 py-1 text-[11px] font-bold text-[#241a06]">
                    تخفیف {toFaDigits(m.planDiscountPercent ?? 0)}٪
                  </span>
                </div>

                <div className="relative mt-6">
                  <div className="text-[11px] opacity-70">دارنده طرح</div>
                  <div className="mt-0.5 font-display text-xl font-bold">{m.holder}</div>
                </div>

                <div className="relative mt-5 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[11px] opacity-70">{m.planTitle}</div>
                    <div dir="ltr" className="mt-1 font-mono text-sm tracking-[0.18em]">{m.cardSerial ?? "—"}</div>
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] opacity-70">اعتبار تا</div>
                    <div className="mt-0.5 text-sm font-bold">{faDate(m.endDate)}</div>
                  </div>
                </div>

                <div className="relative mt-4 flex items-center justify-between rounded-xl bg-white/95 px-3 py-2">
                  <div className="text-[11px] font-medium text-slate-600">
                    باقی‌مانده سهمیه:{" "}
                    <span className="font-bold text-slate-900">
                      {m.usageLimit === null ? "نامحدود" : `${toFaDigits(m.remaining ?? 0)} از ${toFaDigits(m.usageLimit)}`}
                    </span>
                  </div>
                  <CalendarClock className="h-4 w-4 text-[#2a4494]" />
                </div>
              </div>

              {/* بارکد سریال */}
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-5">
                  <Barcode value={m.cardSerial ?? "HK 0000 0000 0000"} height={52} moduleWidth={2} />
                  <p className="text-center text-xs leading-5 text-muted-foreground">
                    این سریال در استعلام پزشک طرف قرارداد، شناسهٔ اعتبار شماست؛ ارائهٔ کارت فیزیکی الزامی نیست.
                  </p>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      {active.length > 0 ? (
        <Card className="mt-6 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-right">
            <div className="flex items-center gap-3">
              <Stethoscope className="h-8 w-8 text-primary" />
              <div>
                <div className="text-sm font-semibold">مراکز درمانی و پزشکان طرف قرارداد</div>
                <div className="mt-0.5 text-xs text-muted-foreground">نزدیک‌ترین پزشک همکار را بر اساس استان، شهر و تخصص پیدا کنید.</div>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/doctors">دایرکتوری پزشکان</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {past.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">عضویت‌های پیشین</h2>
          <div className="space-y-2">
            {past.map((m) => (
              <Card key={m.id} className="opacity-70">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="text-sm">
                    <span className="font-medium">{m.planTitle}</span>
                    <span className="mr-2 text-xs text-muted-foreground">{m.holder} · {label(m.originType)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>تا {faDate(m.endDate)}</span>
                    <StatusBadge status={m.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
