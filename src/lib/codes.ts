// کدهای پیگیری یکتا (PAY-002 · SETTLE-013)
import { randomInt } from "crypto"

export function genTrackingCode(prefix = "HK"): string {
  const t = Date.now().toString(36).toUpperCase().slice(-6)
  const r = randomInt(1000, 9999)
  return `${prefix}-${t}${r}`
}

/**
 * سریال کارت مجازی حامی‌کارت (SURF-USER)
 * قالب: HK + ۱۲ رقم گروه‌بندی‌شده — «HK 1234 5678 9012»
 * یکتایی در سطح دیتابیس (Membership.cardSerial unique) تضمین می‌شود؛
 * در صورت برخورد، فراخواننده تا ۵ بار تلاش مجدد می‌کند.
 */
export function genCardSerial(): string {
  const digits = Array.from({ length: 12 }, () => randomInt(0, 10)).join("")
  return `HK ${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`
}

/**
 * کد رفرال کاربر (REF-SYS) — ۶ نویسه از الفبای بدون ابهام
 * (بدون I/O/0/1/L و مانند آن تا خوانایی پیامکی حفظ شود).
 * یکتایی در سطح دیتابیس (User.referralCode unique) با تلاش مجدد تضمین می‌شود.
 */
const REFERRAL_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export function genReferralCode(): string {
  let out = ""
  for (let i = 0; i < 6; i++) out += REFERRAL_ALPHABET[randomInt(0, REFERRAL_ALPHABET.length)]
  return out
}
