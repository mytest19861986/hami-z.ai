// مدیریت کد یک‌بارمصرف (AUTH-001..003 · AUTH-017 · NOTICE-003)
// وضعیت صادقانه: سرویس پیامک واقعی متصل نیست؛ کد در محیط توسعه نمایش داده می‌شود
// و هیچ «موفقیت ارسال پیامک» جعلی ادعا نمی‌شود (قاعده ۲.۳ PRD).
import { db } from "@/lib/db"
import { randomInt, createHash } from "crypto"
import { normalizeMobile } from "@/lib/validators"

const CODE_TTL_MIN = 3
const MAX_VERIFY_ATTEMPTS = 5
const RESEND_COOLDOWN_SEC = 90
const MAX_SEND_PER_HOUR = 5

export interface OtpSendResult {
  ok: boolean
  error?: string
  retryAfterSec?: number
  devCode?: string // فقط در حالت توسعه و برای نمایش صادقانه «پیامک متصل نیست»
}

export async function sendOtp(rawMobile: string): Promise<OtpSendResult> {
  const mobile = normalizeMobile(rawMobile)
  const now = new Date()

  const recent = await db.otpCode.findMany({
    where: { mobile, createdAt: { gte: new Date(now.getTime() - 3600_000) } },
    orderBy: { createdAt: "desc" },
  })

  const last = recent[0]
  if (last) {
    const since = (now.getTime() - new Date(last.lastSentAt).getTime()) / 1000
    if (since < RESEND_COOLDOWN_SEC) {
      return { ok: false, error: `برای درخواست کد جدید ${Math.ceil(RESEND_COOLDOWN_SEC - since)} ثانیه صبر کنید.`, retryAfterSec: Math.ceil(RESEND_COOLDOWN_SEC - since) }
    }
  }
  const sendsLastHour = recent.reduce((acc, r) => acc + r.sendCount, 0)
  if (sendsLastHour >= MAX_SEND_PER_HOUR) {
    return { ok: false, error: "تعداد درخواست کد در یک ساعت به سقف رسیده است. بعداً تلاش کنید.", retryAfterSec: 3600 }
  }

  const code = String(randomInt(10000, 99999))
  const codeHash = createHash("sha256").update(code).digest("hex")

  // ابطال کدهای قبلی همین شماره
  await db.otpCode.updateMany({
    where: { mobile, consumedAt: null },
    data: { consumedAt: now },
  })

  await db.otpCode.create({
    data: {
      mobile,
      codeHash,
      expiresAt: new Date(now.getTime() + CODE_TTL_MIN * 60_000),
    },
  })

  // پیامک واقعی متصل نیست: کد در پاسخ توسعه‌ای و لاگ سرور ارائه می‌شود (صادقانه و برچسب‌خورده)
  console.log(`[OTP][SMS_NOT_CONNECTED] ${mobile} → ${code}`)
  return { ok: true, devCode: process.env.NODE_ENV === "production" && process.env.SHOW_DEV_OTP !== "true" ? undefined : code }
}

export interface OtpVerifyResult {
  ok: boolean
  error?: string
}

export async function verifyOtp(rawMobile: string, code: string): Promise<OtpVerifyResult> {
  const mobile = normalizeMobile(rawMobile)
  const now = new Date()

  const rec = await db.otpCode.findFirst({
    where: { mobile, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (!rec) return { ok: false, error: "کد فعالی برای این شماره یافت نشد. دوباره درخواست کنید." }
  if (new Date(rec.expiresAt) < now) return { ok: false, error: "کد تأیید منقضی شده است. کد جدید بگیرید." }
  if (rec.attempts >= MAX_VERIFY_ATTEMPTS) return { ok: false, error: "تعداد تلاش ناموفق زیاد است. کد جدید بگیرید." }

  const codeHash = createHash("sha256").update(code).digest("hex")
  if (codeHash !== rec.codeHash) {
    await db.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } })
    return { ok: false, error: "کد تأیید نادرست است." }
  }

  await db.otpCode.update({ where: { id: rec.id }, data: { consumedAt: now } })
  return { ok: true }
}
