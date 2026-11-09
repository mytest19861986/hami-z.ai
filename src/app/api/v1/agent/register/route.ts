import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { isValidProvinceCity } from "@/constants/geo"
import { mobileSchema } from "@/lib/validators"

// درخواست همکاری فروش (AGENT-001..005 · AC-03)
const schema = z.object({
  businessName: z.string().trim().min(2, "نام کسب‌وکار الزامی است.").max(120),
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

  const existing = await db.agent.findUnique({ where: { userId: auth.user.id } })
  if (existing) {
    if (existing.status === "APPROVED") return fail("درخواست همکاری شما قبلاً تأیید شده است.", 409)
    if (["PENDING", "UNDER_REVIEW"].includes(existing.status)) return fail("درخواست شما در انتظار بررسی است.", 409)
    return fail("وضعیت درخواست شما اجازه ثبت مجدد نمی‌دهد. با پشتیبانی تماس بگیرید.", 409)
  }

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

  // نقش کارگزاری؛ عملیات فروش پس از تأیید مدیر فعال می‌شود (AGENT-006 · RBAC-004)
  const role = await db.role.findUnique({ where: { name: "AGENT" } })
  if (role) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: auth.user.id, roleId: role.id } },
      update: {},
      create: { userId: auth.user.id, roleId: role.id },
    })
  }

  await audit(auth.user, "AGENT_REGISTER_REQUEST", "AGENT", agent.id, { businessName: data.businessName })
  return ok({ agentId: agent.id, status: agent.status })
}
