import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"
import { isValidNationalCode, nationalCodeSchema, toEnDigits } from "@/lib/validators"
import { genCardSerial } from "@/lib/codes"

// مدیریت طرح‌ها + اعطای مدیریتی (ADMIN-012..014 · PLAN-001..013 · OPEN-17)
export async function GET() {
  const auth = await requirePermission("plans.manage")
  if ("response" in auth) return auth.response

  const plans = await db.discountPlan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { memberships: true, purchases: true, sales: true } } },
  })

  return ok(
    plans.map((p) => ({
      ...p,
      features: p.features ? JSON.parse(p.features) : [],
      membershipsCount: p._count.memberships,
      purchasesCount: p._count.purchases,
      salesCount: p._count.sales,
    }))
  )
}

const planSchema = z.object({
  title: z.string().trim().min(2, "عنوان طرح الزامی است.").max(120),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  price: z.number({ message: "قیمت را وارد کنید." }).int().min(0, "قیمت نامعتبر است."),
  durationDays: z.number({ message: "مدت اعتبار را وارد کنید." }).int().min(1, "مدت اعتبار حداقل ۱ روز است.").max(3650),
  discountPercent: z.number({ message: "درصد تخفیف را وارد کنید." }).int().min(1, "درصد تخفیف بین ۱ تا ۹۰ است.").max(90),
  usageLimit: z.number().int().min(1, "سقف استفاده حداقل ۱ است.").max(9999).nullable(),
  salesCommissionPercent: z.number().int().min(0, "درصد پورسانت فروش بین ۰ تا ۵۰ است.").max(50),
  referralCommissionPercent: z.number().int().min(0, "درصد پورسانت معرفی بین ۰ تا ۵۰ است.").max(50),
  features: z.array(z.string().trim().max(150)).max(10).optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission("plans.manage")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, planSchema)
  if ("response" in parsed) return parsed.response
  const d = parsed.data

  const plan = await db.discountPlan.create({
    data: {
      title: d.title,
      description: d.description || null,
      price: d.price,
      durationDays: d.durationDays,
      discountPercent: d.discountPercent,
      usageLimit: d.usageLimit ?? null,
      salesCommissionPercent: d.salesCommissionPercent,
      referralCommissionPercent: d.referralCommissionPercent,
      features: d.features?.length ? JSON.stringify(d.features) : null,
      isActive: d.isActive,
      sortOrder: d.sortOrder ?? 0,
    },
  })
  await audit(auth.user, "PLAN_CREATE", "PLAN", plan.id, { title: d.title })
  return ok({ planId: plan.id })
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission("plans.manage")
  if ("response" in auth) return auth.response
  const body = await req.json().catch(() => null)
  const id = (body as { id?: string } | null)?.id
  if (!id) return fail("شناسه طرح الزامی است.", 422)
  const parsed = planSchema.safeParse(body)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "داده نامعتبر است.", 422)
  const d = parsed.data

  const existing = await db.discountPlan.findUnique({ where: { id } })
  if (!existing) return fail("طرح یافت نشد.", 404)

  await db.discountPlan.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description || null,
      price: d.price,
      durationDays: d.durationDays,
      discountPercent: d.discountPercent,
      usageLimit: d.usageLimit ?? null,
      salesCommissionPercent: d.salesCommissionPercent,
      referralCommissionPercent: d.referralCommissionPercent,
      features: d.features?.length ? JSON.stringify(d.features) : null,
      isActive: d.isActive,
      sortOrder: d.sortOrder ?? 0,
    },
  })
  await audit(auth.user, "PLAN_UPDATE", "PLAN", id, { title: d.title })
  return ok({ updated: true })
}

const grantSchema = z.object({
  action: z.literal("grant"),
  planId: z.string(),
  firstName: z.string().trim().min(2, "نام دارنده الزامی است.").max(50),
  lastName: z.string().trim().min(2, "نام خانوادگی الزامی است.").max(50),
  nationalCode: nationalCodeSchema,
  reason: z.string().trim().min(3, "دلیل اعطای مدیریتی الزامی است.").max(400),
  durationDays: z.number().int().min(1).max(3650).optional(),
})

// اعطای مدیریتی طرح — فقط مدیر با ثبت علت (ADMIN-014 · OPEN-17)
export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("plans.manage")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, grantSchema)
  if ("response" in parsed) return parsed.response
  const d = parsed.data

  const plan = await db.discountPlan.findUnique({ where: { id: d.planId } })
  if (!plan) return fail("طرح یافت نشد.", 404)

  const nationalCode = toEnDigits(d.nationalCode).trim()
  if (!isValidNationalCode(nationalCode)) return fail("کد ملی دارنده معتبر نیست.", 422)

  try {
    const result = await db.$transaction(async (tx) => {
      const holder = await tx.planHolder.upsert({
        where: { nationalCode },
        update: {},
        create: { firstName: d.firstName, lastName: d.lastName, nationalCode, createdByUserId: auth.user.id },
      })

      const now = new Date()
      const duration = d.durationDays ?? plan.durationDays
      const membership = await tx.membership.create({
        data: {
          planId: plan.id,
          holderId: holder.id,
          originType: "ADMIN_GRANT",
          startDate: now,
          endDate: new Date(now.getTime() + duration * 86400000),
          status: "ACTIVE",
          cardSerial: genCardSerial(),
          usageLimit: plan.usageLimit,
          grantedById: auth.user.id,
        },
      })
      return membership
    })

    await audit(auth.user, "PLAN_ADMIN_GRANT", "MEMBERSHIP", result.id, { planId: plan.id, holder: nationalCode, reason: d.reason })
    return ok({ membershipId: result.id })
  } catch (e) {
    console.error("[GRANT_FAIL]", e)
    return fail("خطا در اعطای طرح.", 500)
  }
}
