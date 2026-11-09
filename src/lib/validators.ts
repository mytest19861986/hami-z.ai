// اعتبارسنجی داده‌های ایرانی (PROFILE-002 · PROFILE-008 · SETTLE-003)
import { z } from "zod"

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"

export function toEnDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
}

export function normalizeMobile(raw: string): string {
  let s = toEnDigits(raw).replace(/[\s-]/g, "")
  if (s.startsWith("+98")) s = "0" + s.slice(3)
  else if (s.startsWith("0098")) s = "0" + s.slice(4)
  else if (s.startsWith("98") && s.length === 12) s = "0" + s.slice(2)
  else if (s.startsWith("9") && s.length === 10) s = "0" + s
  return s
}

export function isValidMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizeMobile(raw))
}

// کد ملی ۱۰ رقمی با رقم کنترل
export function isValidNationalCode(raw: string): boolean {
  const s = toEnDigits(raw).trim()
  if (!/^\d{10}$/.test(s)) return false
  if (/^(\d)\1{9}$/.test(s)) return false
  const check = parseInt(s[9], 10)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(s[i], 10) * (10 - i)
  const r = sum % 11
  return r < 2 ? check === r : check === 11 - r
}

// شماره شبا IR + 24 رقم با آزمون mod-97 (ISO 7064)
export function isValidSheba(raw: string): boolean {
  let s = toEnDigits(raw).trim().toUpperCase().replace(/[\s-]/g, "")
  if (s.startsWith("IR")) s = s.slice(2)
  if (!/^\d{24}$/.test(s)) return false
  const rearranged = s + "1827" // "IR" → I=18, R=27
  let remainder = 0
  for (const ch of rearranged) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97
  }
  return remainder === 1
}

// شماره کارت ۱۶ رقمی با الگوریتم Luhn
export function isValidCardNumber(raw: string): boolean {
  const s = toEnDigits(raw).replace(/[\s-]/g, "")
  if (!/^\d{16}$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 16; i++) {
    let d = parseInt(s[i], 10)
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function normalizeSheba(raw: string): string {
  let s = toEnDigits(raw).trim().toUpperCase().replace(/[\s-]/g, "")
  if (!s.startsWith("IR")) s = "IR" + s
  return s
}

export function maskCard(card?: string | null): string {
  if (!card) return "—"
  const s = toEnDigits(card)
  return s.length >= 16 ? `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}` : s
}

export function maskSheba(sheba?: string | null): string {
  if (!sheba) return "—"
  return `${sheba.slice(0, 4)} •••• •••• ${sheba.slice(-4)}`
}

// ─── اسکیماهای Zod مشترک ───
export const mobileSchema = z
  .string()
  .transform(normalizeMobile)
  .refine(isValidMobile, "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)")

export const otpSchema = z
  .string()
  .transform(toEnDigits)
  .refine((s) => /^\d{5}$/.test(s), "کد تأیید ۵ رقمی است")

export const nationalCodeSchema = z
  .string()
  .transform((s) => toEnDigits(s).trim())
  .refine((s) => s === "" || isValidNationalCode(s), "کد ملی معتبر نیست")

export const shebaSchema = z
  .string()
  .transform((s) => normalizeSheba(s))
  .refine((s) => isValidSheba(s), "شماره شبا معتبر نیست (IR + ۲۴ رقم)")

export const cardNumberSchema = z
  .string()
  .transform((s) => toEnDigits(s).replace(/[\s-]/g, ""))
  .refine((s) => isValidCardNumber(s), "شماره کارت ۱۶ رقمی معتبر نیست")

export const amountSchema = z
  .number({ message: "مبلغ نامعتبر است" })
  .int("مبلغ باید عدد صحیح باشد")
  .positive("مبلغ باید مثبت باشد")
