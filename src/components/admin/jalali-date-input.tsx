"use client"

// تقویم شمسی سبک برای انتخاب تاریخ (بازهٔ «آمار و بررسی» دکمهٔ عملیات پزشکان)
// مبدل‌ها از lib/jalali استفاده می‌کنند؛ بدون وابستگی بیرونی (UX-002)
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { JALALI_MONTHS, toFaDigits, toGregorian, toJalali } from "@/lib/jalali"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const WEEKDAY_INITIALS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]

export interface JalaliDate {
  jy: number
  jm: number
  jd: number
}

function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  // کبیسه: اگر از اسفند ۱ تا فروردین ۱ سال بعد ۳۰ روز فاصله باشد، اسفند ۳۰ روزه است
  const a = toGregorian(jy, 12, 1)
  const b = toGregorian(jy + 1, 1, 1)
  const diffDays = (Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000
  return diffDays === 30 ? 30 : 29
}

export function dateToJalali(d: Date): JalaliDate {
  const [jy, jm, jd] = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return { jy, jm, jd }
}

export function jalaliToDate(d: JalaliDate): Date {
  const [gy, gm, gd] = toGregorian(d.jy, d.jm, d.jd)
  return new Date(gy, gm - 1, gd)
}

// تاریخ میلادی ISO (YYYY-MM-DD) برای ارسال به API
export function toIsoDate(d: JalaliDate): string {
  const [gy, gm, gd] = toGregorian(d.jy, d.jm, d.jd)
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`
}

// تاریخ ISO دریافتی از API (YYYY-MM-DD) → شمسی
export function isoToJalali(iso: string): JalaliDate {
  const [y, m, d] = iso.split("-").map(Number)
  const [jy, jm, jd] = toJalali(y, m, d)
  return { jy, jm, jd }
}

export function formatJalaliNumeric(d: JalaliDate | null | undefined): string {
  if (!d) return ""
  return toFaDigits(`${d.jy}/${String(d.jm).padStart(2, "0")}/${String(d.jd).padStart(2, "0")}`)
}

function shiftMonth(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  let m = jm + delta
  let y = jy
  while (m > 12) {
    m -= 12
    y += 1
  }
  while (m < 1) {
    m += 12
    y -= 1
  }
  return { jy: y, jm: m }
}

export function JalaliDateInput({
  value,
  onChange,
  disabled,
  placeholder = "انتخاب تاریخ",
  "aria-label": ariaLabel,
}: {
  value: JalaliDate | null
  onChange: (d: JalaliDate) => void
  disabled?: boolean
  placeholder?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<JalaliDate>(() => value ?? dateToJalali(new Date()))

  const today = dateToJalali(new Date())
  const daysInMonth = jalaliMonthLength(view.jy, view.jm)

  // ستون شروع: هفتهٔ ایرانی از شنبه شروع می‌شود (getDay: یکشنبه=۰ … شنبه=۶)
  const firstG = jalaliToDate({ ...view, jd: 1 })
  const firstCol = (firstG.getDay() + 1) % 7
  const cells: (number | null)[] = [
    ...Array.from({ length: firstCol }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setView(value ?? today)
  }

  const prev = shiftMonth(view.jy, view.jm, -1)
  const next = shiftMonth(view.jy, view.jm, 1)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} aria-label={ariaLabel} className="min-w-32 justify-between gap-2 font-normal">
          <span className="tabular-nums" dir="ltr">{value ? formatJalaliNumeric(value) : placeholder}</span>
          <CalendarDays className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between gap-2 pb-2">
          <button
            type="button"
            aria-label="ماه قبل"
            className="rounded-md p-1 hover:bg-accent"
            onClick={() => setView({ ...view, ...prev })}
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="text-sm font-semibold">
            {JALALI_MONTHS[view.jm - 1]} {toFaDigits(view.jy)}
          </div>
          <button
            type="button"
            aria-label="ماه بعد"
            className="rounded-md p-1 hover:bg-accent"
            onClick={() => setView({ ...view, ...next })}
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1" dir="rtl">
          {WEEKDAY_INITIALS.map((w, i) => (
            <span key={i} className="flex h-7 w-9 items-center justify-center text-[11px] text-muted-foreground">
              {w}
            </span>
          ))}
          {cells.map((jd, i) => {
            if (jd === null) return <span key={`empty-${i}`} className="h-8 w-9" />
            const isSelected = value?.jy === view.jy && value?.jm === view.jm && value?.jd === jd
            const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === jd
            return (
              <button
                key={jd}
                type="button"
                className={cn(
                  "flex h-8 w-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors hover:bg-accent",
                  isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  !isSelected && isToday && "border border-primary/40 text-primary"
                )}
                onClick={() => {
                  onChange({ jy: view.jy, jm: view.jm, jd })
                  setOpen(false)
                }}
              >
                {toFaDigits(jd)}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
