// تنظیمات محصول (ADMIN-023) — مقادیر با پیش‌فرض امن
// تصمیم‌های باز تجاری PRD (OPEN-01..18) به‌صورت پارامتر قابل ویرایش مدیر ارشد
import { db } from "@/lib/db"

export type SettingGroup = "مالی و تجاری" | "هویت و نقش‌ها" | "عملیات و زیرساخت"

export const SETTING_DEFAULTS: Record<
  string,
  { value: string; title: string; description?: string; superOnly?: boolean; group: SettingGroup }
> = {
  // ─── گروه: مالی و تجاری ───
  MIN_SETTLEMENT_AMOUNT: {
    value: "100000",
    title: "حداقل مبلغ درخواست تسویه (تومان) — OPEN-06",
    description: "درخواست تسویه کمتر از این مبلغ پذیرفته نمی‌شود. مقدار مصوب نقشه راه: ۱۰۰٬۰۰۰ تومان.",
    superOnly: true,
    group: "مالی و تجاری",
  },
  DISCOUNT_PRECEDENCE: {
    value: "DOCTOR",
    title: "تقدم درصد تخفیف — OPEN-02",
    description: "DOCTOR = درصد اختصاصی پزشک (در صورت وجود) مقدم بر درصد طرح است؛ PLAN = درصد طرح همیشه مقدم است.",
    superOnly: true,
    group: "مالی و تجاری",
  },
  SALE_FINALIZATION_STAGE: {
    value: "FINALIZED",
    title: "مرحله قطعی‌شدن فروش نمایندگی — OPEN-03",
    description: "عضویت و پورسانت فروش در مرحله FINALIZED (تحویل و ثبت پرداخت) قطعی می‌شود؛ مراحل قبلی فقط رهگیری‌اند.",
    superOnly: true,
    group: "مالی و تجاری",
  },
  COMMISSION_STACKING: {
    value: "NOT_ALLOWED",
    title: "تجمع پورسانت فروش و معرفی — OPEN-05",
    description: "NOT_ALLOWED = برای یک فروش فقط یکی از پورسانت فروش یا معرفی محاسبه می‌شود؛ ALLOWED = جمع هر دو با سقف طرح.",
    superOnly: true,
    group: "مالی و تجاری",
  },
  REFUND_RESTORE_POLICY: {
    value: "IMMEDIATE",
    title: "سیاست بازگشت اعتبار و پورسانت — OPEN-07",
    description: "IMMEDIATE = با مرجوعی/لغو، سهمیه بلافاصله باز و پورسانت مرتبط باطل می‌شود؛ MANUAL = نیازمند تصمیم مدیر.",
    superOnly: true,
    group: "مالی و تجاری",
  },
  CURRENCY_UNIT: {
    value: "تومان",
    title: "واحد مبالغ — OPEN-18",
    description: "واحد نمایش تمام مبالغ سامانه.",
    group: "مالی و تجاری",
  },
  COMMISSION_ROUNDING: {
    value: "FLOOR",
    title: "قاعده گردکردن پورسانت — OPEN-18",
    description: "FLOOR = گرد به پایین به نزدیک‌ترین تومان؛ CEIL = گرد به بالا؛ NEAREST = نزدیک‌ترین.",
    superOnly: true,
    group: "مالی و تجاری",
  },
  MULTIPLE_ACTIVE_PLANS: {
    value: "ALLOWED",
    title: "چند طرح فعال هم‌زمان برای یک دارنده — OPEN-08",
    description: "ALLOWED = دارنده می‌تواند چند عضویت فعال داشته باشد و پزشک هنگام ثبت یکی را انتخاب می‌کند؛ NOT_ALLOWED = طرح جدید جایگزین می‌شود.",
    superOnly: true,
    group: "مالی و تجاری",
  },
  PLAN_ACTIVATION_WITHOUT_PAYMENT: {
    value: "SUPER_ADMIN",
    title: "فعال‌سازی طرح بدون پرداخت — OPEN-17",
    description: "SUPER_ADMIN = فقط مدیر ارشد (اعطای دستی طرح)؛ AGENT_WITH_APPROVAL = نماینده با تأیید مدیر.",
    superOnly: true,
    group: "مالی و تجاری",
  },

  // ─── گروه: هویت و نقش‌ها ───
  REFERRER_VS_AGENT_SCOPE: {
    value: "SEPARATE_ROLES",
    title: "تفکیک نقش معرف از نماینده فروش — OPEN-01",
    description: "SEPARATE_ROLES = معرف فقط پورسانت معرفی می‌گیرد و به چرخه فروش/کارت دسترسی ندارد؛ SAME_AS_AGENT = اختیارات یکسان.",
    superOnly: true,
    group: "هویت و نقش‌ها",
  },
  MANUAL_PAYMENT_REGISTRAR: {
    value: "SUPER_ADMIN",
    title: "ثبت‌کننده مجاز پرداخت دستی — OPEN-04",
    description: "چه کسی می‌تواند پرداخت فروش (تحویل) و پرداخت تسویه را ثبت کند: SUPER_ADMIN یا ADMIN_AND_SUPER.",
    superOnly: true,
    group: "هویت و نقش‌ها",
  },
  IDENTITY_CONFLICT_POLICY: {
    value: "REJECT_DUPLICATE",
    title: "سیاست تعارض هویتی دارنده — OPEN-09",
    description: "REJECT_DUPLICATE = کد ملی تکراری برای دو دارنده رد می‌شود؛ MERGE_BY_MOBILE = ادغام بر اساس شماره همراه.",
    superOnly: true,
    group: "هویت و نقش‌ها",
  },
  ADMIN_VS_SUPER_ADMIN_MATRIX: {
    value: "DOCUMENTED",
    title: "ماتریس اختیار مدیر عادی و ارشد — OPEN-10",
    description: "مبنای تفکیک: تنظیمات حساس مالی و ثبت پرداخت تسویه فقط مدیر ارشد (مجوزهای settings.manage و settlements.mark_paid).",
    superOnly: true,
    group: "هویت و نقش‌ها",
  },

  // ─── گروه: عملیات و زیرساخت ───
  SMS_STATUS: {
    value: "NOT_CONNECTED",
    title: "وضعیت سرویس پیامک — OPEN-11",
    description: "اتصال پیامک واقعی به‌عنوان بسته کاری مستقل فعال می‌شود.",
    superOnly: true,
    group: "عملیات و زیرساخت",
  },
  PAYMENT_STATUS: {
    value: "NOT_CONNECTED",
    title: "وضعیت درگاه پرداخت — OPEN-11",
    description: "اتصال درگاه پرداخت واقعی به‌عنوان بسته کاری مستقل فعال می‌شود.",
    superOnly: true,
    group: "عملیات و زیرساخت",
  },
  MEDICAL_DATA_RETENTION_DAYS: {
    value: "730",
    title: "دوره نگهداری داده‌های پزشکی (روز) — OPEN-12",
    description: "سقف نگهداری سوابق ویزیت و داده‌های حساس درمانی پیش از پاک‌سازی.",
    superOnly: true,
    group: "عملیات و زیرساخت",
  },
  BACKUP_RETENTION_DAYS: {
    value: "90",
    title: "دوره نگهداری نسخه‌های پشتیبان (روز) — OPEN-13",
    description: "مدت نگهداری نسخه‌های پشتیبان دیتابیس.",
    superOnly: true,
    group: "عملیات و زیرساخت",
  },
  CONCURRENT_USER_TARGET: {
    value: "500",
    title: "هدف کاربر هم‌زمان — OPEN-14",
    description: "معیار ظرفیت عملیاتی برای پایش دسترس‌پذیری.",
    superOnly: true,
    group: "عملیات و زیرساخت",
  },
  BRAND_IDENTITY_VERSION: {
    value: "VAZIRMATN_ESTEAD_V1",
    title: "نسخه هویت بصری و فونت — OPEN-15",
    description: "هویت جاری: Vazirmatn (متن) + Estedad (نمایشی) — پالت لاجوردی/کهربایی.",
    group: "عملیات و زیرساخت",
  },
  MEDICAL_RECORDS_SCOPE: {
    value: "NONE",
    title: "دامنه ثبت مدارک پزشکی — OPEN-16",
    description: "NONE = ثبت/نمایش سند پزشکی (نسخه/گزارش) در محصول جاری مجاز نیست؛ فقط یادداشت محرمانه ویزیت.",
    superOnly: true,
    group: "عملیات و زیرساخت",
  },
  SITE_TAGLINE: { value: "تخفیف واقعی خدمات درمانی، در سراسر ایران", title: "شعار صفحه اصلی", group: "عملیات و زیرساخت" },
  CONTACT_PHONE: { value: "۰۱۱-۳۳۳۳۴۴۴۴", title: "تلفن تماس", group: "عملیات و زیرساخت" },
  CONTACT_EMAIL: { value: "info@hamikart.ir", title: "ایمیل تماس", group: "عملیات و زیرساخت" },
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
