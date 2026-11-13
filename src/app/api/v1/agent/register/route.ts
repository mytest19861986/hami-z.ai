import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { isValidProvinceCity } from "@/constants/geo"
import { mobileSchema, nationalCodeSchema } from "@/lib/validators"
import { setUserRole } from "@/lib/roles"

// درخواست همکاری فروش (AGENT-001..005 · AC-03)
// تک‌نقشی (SINGLE-ROLE): هر موبایل/حساب فقط یک نقش — درخواست نمایندگی یعنی جایگزینی نقش فعلی با AGENT
// یکتایی هویت: کد ملی و شماره موبایل در سراسر سامانه (کاربران، پروفایل‌ها، دارندگان طرح) یکتاست
const schema = z.object({
  businessName: z.string().trim().min(2, "نام کسب‌وکار الزامی است.").max(120),
  nationalCode: nationalCodeSchema.refine((s) => s !== "", "کد ملی الزامی است."),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  province: z.string().min(1, "استان را انتخاب کنید."),
  city: z.string().min(1, "شهر را انتخاب کنید."),
  phone: mobileSchema.optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, schema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  if (!isValidProvinceCity(data.province, data.city)) {
    return fail("شهر انتخاب‌شده به استان تعلق ندارد.", 422)
  }

  // تک‌نقشی: حسابی که نقش عملیاتی دیگری (پزشک، پشتیبان، مدیر…) دارد نمی‌تواند نماینده شود
  const authRoles = auth.user.roles
  if (authRoles.some((r) => r !== "USER" && r !== "AGENT")) {
    return fail("این حساب دارای نقش دیگری است. هر شماره موبایل فقط می‌تواند یک نقش داشته باشد.", 409)
  }

  const existing = await db.agent.findUnique({ where: { userId: auth.user.id } })
  if (existing) {
    if (existing.status === "APPROVED") return fail("درخواست همکاری شما قبلاً تأیید شده است.", 409)
    if (["PENDING", "UNDER_REVIEW"].includes(existing.status)) return fail("درخواست شما در انتظار بررسی است.", 409)
    return fail("وضعیت درخواست شما اجازه ثبت مجدد نمی‌دهد. با پشتیبانی تماس بگیرید.", 409)
  }

  // یکتایی کد ملی در سراسر سامانه: پروفایل‌های دیگر + دارندگان طرح (SINGLE-IDENTITY)
  const dupNcProfile = await db.userProfile.findFirst({
    where: { nationalCode: data.nationalCode, NOT: { userId: auth.user.id } },
  })
  if (dupNcProfile) return fail("این کد ملی قبلاً برای حساب دیگری ثبت شده است.", 409)
  const dupNcHolder = await db.planHolder.findUnique({ where: { nationalCode: data.nationalCode } })
  if (dupNcHolder) return fail("این کد ملی قبلاً به‌عنوان دارندهٔ طرح ثبت شده است.", 409)

  const agent = await db.agent.create({
    data: {
      userId: auth.user.id,
      businessName: data.businessName,
      description: data.description || null,
      province: data.province,
      city: data.city,
      phone: data.phone || null,
      status: "PENDING",
    },
  })

  // تک‌نقشی: نقش کارگزاری جایگزین نقش فعلی می‌شود؛ عملیات فروش پس از تأیید مدیر فعال است (AGENT-006 · RBAC-004)
  const previousRoles = authRoles.join(",") || "—"
  await setUserRole(auth.user.id, "AGENT")

  await audit(auth.user, "AGENT_REGISTER_REQUEST", "AGENT", agent.id, {
    businessName: data.businessName,
    previousRoles,
    singleRole: "AGENT",
  })
  return ok({ agentId: agent.id, status: agent.status })
}
