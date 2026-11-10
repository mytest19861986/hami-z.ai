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

// کد ملی: دقیقاً ۱۰ رقم (طبق مصوبه کارفرما، بدون نیاز به اعتبارسنجی رقم کنترل)
export function isValidNationalCode(raw: string): boolean {
  return /^\d{10}$/.test(toEnDigits(raw).trim())
}

// شبا: IR + ۲۴ رقم (طبق مصوبه کارفرما، بدون نیاز به آزمون رقم کنترل mod-97)
export function isValidSheba(raw: string): boolean {
  let s = toEnDigits(raw).trim().toUpperCase().replace(/[\s-]/g, "")
  if (s.startsWith("IR")) s = s.slice(2)
  return /^\d{24}$/.test(s)
}

// شماره کارت بانکی: دقیقاً ۱۶ رقم (طبق مصوبه کارفرما، بدون نیاز به الگوریتم Luhn)
export function isValidCardNumber(raw: string): boolean {
  return /^\d{16}$/.test(toEnDigits(raw).replace(/[\s-]/g, ""))
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
  .refine((s) => s === "" || isValidNationalCode(s), "کد ملی باید دقیقاً ۱۰ رقم باشد")

export const shebaSchema = z
  .string()
  .transform((s) => normalizeSheba(s))
  .refine((s) => isValidSheba(s), "شماره شبا معتبر نیست (۲۴ رقم، با یا بدون IR)")

export const cardNumberSchema = z
  .string()
  .transform((s) => toEnDigits(s).replace(/[\s-]/g, ""))
  .refine((s) => isValidCardNumber(s), "شماره کارت باید دقیقاً ۱۶ رقم باشد")

export const amountSchema = z
  .number({ message: "مبلغ نامعتبر است" })
  .int("مبلغ باید عدد صحیح باشد")
  .positive("مبلغ باید مثبت باشد")

// سیاست رمز عبور برای «تعیین/تغییر» رمز (SEC): حداقل ۸ نویسه شامل حرف و رقم
// توجه: ورود با رمز موجود با حداقل ۶ نویسه پذیرفته می‌شود تا رمزهای قدیمی قفل نشوند
export const newPasswordSchema = z
  .string({ message: "رمز عبور الزامی است" })
  .min(8, "رمز عبور حداقل ۸ نویسه است")
  .refine((s) => /[A-Za-zآ-ی]/.test(s) && /\d/.test(s), "رمز عبور باید شامل حرف و رقم باشد")
