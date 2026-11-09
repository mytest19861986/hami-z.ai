// قالب‌بندی مبالغ و داده‌ها (UX-003 · BR-28) — واحد پیش‌فرض: تومان
import { toFaDigits } from "./jalali"

export const CURRENCY = "تومان"

export function formatToman(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "—"
  return `${toFaDigits(amount.toLocaleString("en-US").replace(/,/g, "،"))} ${CURRENCY}`
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—"
  return toFaDigits(n.toLocaleString("en-US").replace(/,/g, "،"))
}

export function formatPercent(p: number | null | undefined): string {
  if (p === null || p === undefined) return "—"
  return `${toFaDigits(p)}٪`
}

// محاسبه پورسانت با گردکردن به نزدیک‌ترین تومان (OPEN-18 — فرض مستند)
export function commissionAmount(base: number, percent: number): number {
  return Math.round((base * percent) / 100)
}

export function discountAmount(total: number, percent: number): number {
  return Math.round((total * percent) / 100)
}
