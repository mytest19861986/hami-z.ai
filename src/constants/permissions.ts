// ماتریس دسترسی RBAC (RBAC-001..009 · ADMIN-020 · AC-13)
export const ROLE_NAMES = {
  USER: "کاربر عادی",
  DOCTOR: "پزشک",
  AGENT: "نماینده فروش",
  REFERRER: "همکار معرفی",
  SUPPORT: "پشتیبان",
  ADMIN: "مدیر",
  SUPER_ADMIN: "مدیر ارشد",
} as const

export type RoleName = keyof typeof ROLE_NAMES

export interface PermissionDef {
  name: string
  title: string
  module: string
}

export const PERMISSIONS: PermissionDef[] = [
  { name: "users.view", title: "مشاهده کاربران", module: "users" },
  { name: "users.manage", title: "مدیریت کاربران و نقش‌ها", module: "users" },
  { name: "doctors.view_all", title: "مشاهده همه پزشکان", module: "doctors" },
  { name: "doctors.review", title: "بررسی و تأیید پزشکان", module: "doctors" },
  { name: "agents.view_all", title: "مشاهده همه نمایندگان", module: "agents" },
  { name: "agents.review", title: "بررسی و تأیید نمایندگان", module: "agents" },
  { name: "plans.manage", title: "مدیریت طرح‌ها", module: "plans" },
  { name: "purchases.view_all", title: "مشاهده همه خریدها", module: "purchases" },
  { name: "purchases.review", title: "بررسی و تأیید خریدها", module: "purchases" },
  { name: "sales.view_all", title: "مشاهده همه فروش‌ها", module: "sales" },
  { name: "sales.review", title: "بررسی فروش و چرخه کارت", module: "sales" },
  { name: "commissions.view_all", title: "مشاهده همه پورسانت‌ها", module: "commissions" },
  { name: "commissions.review", title: "تأیید/رد پورسانت", module: "commissions" },
  { name: "settlements.view_all", title: "مشاهده همه تسویه‌ها", module: "settlements" },
  { name: "settlements.review", title: "بررسی تسویه (تأیید/رد)", module: "settlements" },
  { name: "settlements.mark_paid", title: "ثبت پرداخت تسویه (حساس)", module: "settlements" },
  { name: "visits.view_all", title: "مشاهده همه ویزیت‌ها", module: "visits" },
  { name: "reviews.moderate", title: "مدیریت نظرات پزشکان", module: "visits" },
  { name: "reports.view", title: "مشاهده گزارش‌ها", module: "reports" },
  { name: "content.manage", title: "مدیریت محتوای صفحات", module: "content" },
  { name: "notifications.broadcast", title: "ارسال اعلان همگانی", module: "content" },
  { name: "settings.view", title: "مشاهده تنظیمات", module: "settings" },
  { name: "settings.manage", title: "تغییر تنظیمات حساس (ویژه مدیر ارشد)", module: "settings" },
  { name: "audit.view", title: "مشاهده رخدادهای مدیریتی", module: "audit" },
  { name: "support.tools", title: "ابزارهای پشتیبانی", module: "support" },
]

// ADMIN-020: اختیار ثبت پرداخت تسویه و تنظیمات حساس فقط برای مدیر ارشد
export const ROLE_PERMISSION_MATRIX: Record<RoleName, string[]> = {
  USER: [],
  DOCTOR: [],
  AGENT: [],
  REFERRER: [],
  SUPPORT: ["users.view", "support.tools"],
  ADMIN: [
    "users.view", "users.manage",
    "doctors.view_all", "doctors.review",
    "agents.view_all", "agents.review",
    "plans.manage",
    "purchases.view_all", "purchases.review",
    "sales.view_all", "sales.review",
    "commissions.view_all", "commissions.review",
    "settlements.view_all", "settlements.review",
    "visits.view_all", "reviews.moderate",
    "reports.view", "content.manage", "notifications.broadcast",
    "settings.view", "audit.view",
  ],
  SUPER_ADMIN: PERMISSIONS.map((p) => p.name),
}

export const ADMIN_ROLES: RoleName[] = ["ADMIN", "SUPER_ADMIN"]

export function roleHome(roles: string[]): string {
  if (roles.includes("SUPER_ADMIN") || roles.includes("ADMIN") || roles.includes("SUPPORT")) return "/admin"
  if (roles.includes("DOCTOR")) return "/doctor"
  if (roles.includes("AGENT")) return "/agent"
  return "/user"
}
