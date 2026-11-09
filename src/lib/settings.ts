// تنظیمات محصول (ADMIN-023) — مقادیر با پیش‌فرض امن
import { db } from "@/lib/db"

export const SETTING_DEFAULTS: Record<string, { value: string; title: string; description?: string; superOnly?: boolean }> = {
  MIN_SETTLEMENT_AMOUNT: { value: "100000", title: "حداقل مبلغ درخواست تسویه (تومان)", description: "درخواست تسویه کمتر از این مبلغ پذیرفته نمی‌شود.", superOnly: true },
  SMS_STATUS: { value: "NOT_CONNECTED", title: "وضعیت سرویس پیامک", description: "اتصال پیامک واقعی به‌عنوان بسته کاری مستقل فعال می‌شود.", superOnly: true },
  PAYMENT_STATUS: { value: "NOT_CONNECTED", title: "وضعیت درگاه پرداخت", description: "اتصال درگاه پرداخت واقعی به‌عنوان بسته کاری مستقل فعال می‌شود.", superOnly: true },
  SITE_TAGLINE: { value: "تخفیف واقعی خدمات درمانی، در سراسر ایران", title: "شعار صفحه اصلی" },
  CONTACT_PHONE: { value: "۰۲۱-۹۱۰۰۰۰۰۰", title: "تلفن تماس" },
  CONTACT_EMAIL: { value: "info@hamikart.ir", title: "ایمیل تماس" },
}

export async function getSetting(key: string): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } })
  return row?.value ?? SETTING_DEFAULTS[key]?.value ?? ""
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany()
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(SETTING_DEFAULTS)) out[k] = v.value
  for (const r of rows) out[r.key] = r.value
  return out
}
