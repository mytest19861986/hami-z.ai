// برچسب‌های فارسی وضعیت‌ها — یک منبع واحد برای کل محصول (UX-013 · BR-28)
export const LABELS: Record<string, string> = {
  // User
  ACTIVE: "فعال",
  SUSPENDED: "تعلیق‌شده",
  BLOCKED: "مسدود",
  DELETED: "حذف‌شده",
  // Doctor
  PENDING: "در انتظار بررسی",
  UNDER_REVIEW: "در حال بررسی",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
  // Purchase
  SUCCESS: "موفق",
  FAILED: "ناموفق",
  CANCELLED: "لغوشده",
  REFUNDED: "بازپرداخت‌شده",
  // Sale workflow (SALE-004)
  PENDING_REVIEW: "در انتظار بررسی",
  CARD_ISSUED: "کارت صادر شد",
  SENT: "ارسال شد",
  DELIVERED: "تحویل شد",
  PAYMENT_REGISTERED: "پرداخت ثبت شد",
  FINALIZED: "نهایی شد",
  RETURNED: "مرجوع شد",
  // Commission / settlement
  PAID: "پرداخت‌شده",
  // Visit
  COMPLETED: "تکمیل‌شده",
  // Membership origin
  PURCHASE: "خرید",
  AGENT_SALE: "فروش نماینده",
  ADMIN_GRANT: "اعطای مدیریتی",
  // Wallet tx
  COMMISSION_CREDIT: "افزایش اعتبار (پورسانت)",
  HOLD: "نگهداشت (درخواست تسویه)",
  RELEASE: "آزادسازی اعتبار",
  SETTLE_PAID: "ثبت تسویه",
  ADMIN_ADJUST: "اصلاح مدیریتی",
  // Doc types
  NATIONAL_CARD: "کارت ملی",
  BUSINESS_LICENSE: "مجوز فعالیت",
  OTHER: "سایر مدارک",
  // Notifications
  INFO: "اطلاع‌رسانی",
  WARNING: "هشدار",
  ERROR: "خطا",
  // discount base
  PLAN: "درصد طرح",
  DOCTOR: "درصد اختصاصی پزشک",
  DRAFT: "پیش‌نویس",
  PUBLISHED: "منتشرشده",
}

export function label(key?: string | null): string {
  if (!key) return "—"
  return LABELS[key] ?? key
}

export const COMMISSION_TYPE_LABELS: Record<string, string> = {
  SALE: "پورسانت فروش",
  REFERRAL: "پورسانت معرفی",
}

export const GENDER_LABELS: Record<string, string> = {
  MALE: "مرد",
  FEMALE: "زن",
}
