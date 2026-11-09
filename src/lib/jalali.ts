// تبدیل و قالب‌بندی تاریخ شمسی (UX-002) — بدون وابستگی بیرونی

const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
]

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
export function toFaDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)])
}

function div(a: number, b: number): number {
  return Math.trunc(a / b)
}

// میلادی → جلالی
export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let jy = gy <= 1600 ? 0 : 979
  gy -= gy <= 1600 ? 621 : 1600
  const gy2 = gm > 2 ? gy + 1 : gy
  let days =
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1]
  jy += 33 * div(days, 12053)
  days %= 12053
  jy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) {
    jy += div(days - 1, 365)
    days = (days - 1) % 365
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return [jy, jm, jd]
}

// جلالی → میلادی
export function toGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy <= 979 ? 621 : 1600
  jy -= jy <= 979 ? 0 : 979
  let days =
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186)
  gy += 400 * div(days, 146097)
  days %= 146097
  if (days > 36524) {
    gy += 100 * div(--days, 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) {
    gy += div(days - 1, 365)
    days = (days - 1) % 365
  }
  let gd = days + 1
  const sal_a = [
    0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ]
  let gm = 0
  for (gm = 1; gm <= 12; gm++) {
    if (gd <= sal_a[gm]) break
    gd -= sal_a[gm]
  }
  return [gy, gm, gd]
}

export function faDate(d: Date | string | number | null | undefined): string {
  if (!d) return "—"
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return "—"
  const [jy, jm, jd] = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate())
  return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`
}

export function faDateTime(d: Date | string | number | null | undefined): string {
  if (!d) return "—"
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return "—"
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${faDate(date)} — ${toFaDigits(`${hh}:${mm}`)}`
}

export function daysUntil(d: Date | string | null | undefined): number {
  if (!d) return 0
  const date = d instanceof Date ? d : new Date(d)
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}
