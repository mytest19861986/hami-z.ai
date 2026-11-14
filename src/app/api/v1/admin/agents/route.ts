import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"
import { isValidProvinceCity } from "@/constants/geo"

// مدیریت نمایندگان و مدارک (ADMIN-007..011 · AGENT-010 · AC-03)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("agents.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 15

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { user: { mobile: { contains: q } } },
            { user: { profile: { firstName: { contains: q } } } },
            { user: { profile: { lastName: { contains: q } } } },
            { businessName: { contains: q } },
          ],
        }
      : {}),
  }

  const [total, agents] = await Promise.all([
    db.agent.count({ where }),
    db.agent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        user: { select: { id: true, mobile: true, profile: { select: { firstName: true, lastName: true } } } },
        documents: true,
        _count: { select: { customers: true } },
      },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    agents: agents.map((a) => ({
      id: a.id,
      userId: a.user.id,
      name: `${a.user.profile?.firstName ?? ""} ${a.user.profile?.lastName ?? ""}`.trim() || "—",
      firstName: a.user.profile?.firstName ?? null,
      lastName: a.user.profile?.lastName ?? null,
      mobile: a.user.mobile,
      businessName: a.businessName,
      description: a.description,
      province: a.province,
      city: a.city,
      phone: a.phone,
      status: a.status,
      rejectReason: a.rejectReason,
      documents: a.documents.map((d) => ({
        id: d.id,
        docType: d.docType,
        fileName: d.fileName,
        filePath: d.filePath,
        status: d.status,
        rejectReason: d.rejectReason,
      })),
      customersCount: a._count.customers,
      createdAt: a.createdAt,
    })),
  })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review_agent"),
    agentId: z.string(),
    decision: z.enum(["APPROVE", "REJECT", "SUSPEND", "START_REVIEW"]),
    reason: z.string().trim().max(400).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("review_document"),
    documentId: z.string(),
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().max(400).optional().or(z.literal("")),
  }),
  // مشاهده / ویرایش اطلاعات — دکمهٔ «عملیات» در صفحهٔ نمایندگان ادمین
  z.object({
    action: z.literal("update_profile"),
    agentId: z.string(),
    firstName: z.string().trim().max(60, "نام حداکثر ۶۰ نویسه است.").optional(),
    lastName: z.string().trim().max(60, "نام خانوادگی حداکثر ۶۰ نویسه است.").optional(),
    businessName: z.string().trim().max(150, "نام کسب‌وکار حداکثر ۱۵۰ نویسه است.").optional(),
    description: z.string().trim().max(600, "توضیحات حداکثر ۶۰۰ نویسه است.").optional(),
    phone: z.string().trim().max(30, "تلفن حداکثر ۳۰ نویسه است.").optional(),
    province: z.string().trim().max(60).optional(),
    city: z.string().trim().max(60).optional(),
  }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission("agents.review")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, actionSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  if (data.action === "review_agent") {
    const agent = await db.agent.findUnique({ where: { id: data.agentId }, include: { user: true, documents: true } })
    if (!agent) return fail("نماینده یافت نشد.", 404)

    const statusMap: Record<string, string> = { APPROVE: "APPROVED", REJECT: "REJECTED", SUSPEND: "SUSPENDED", START_REVIEW: "UNDER_REVIEW" }
    const status = statusMap[data.decision]
    const needsReason = data.decision === "REJECT" || data.decision === "SUSPEND"
    if (needsReason && (data.reason ?? "").trim().length < 3) return fail("برای رد یا تعلیق، ثبت دلیل الزامی است.", 422)

    // کنترل کامل‌بودن مدارک لازم پیش از تأیید (ADMIN-009)
    if (data.decision === "APPROVE" && agent.documents.filter((d) => d.status === "APPROVED").length === 0) {
      return fail("تأیید نماینده نیازمند حداقل یک مدرک تأییدشده است. ابتدا مدارک را بررسی کنید.", 422)
    }

    await db.agent.update({
      where: { id: agent.id },
      data: { status, rejectReason: needsReason ? data.reason : null, reviewedById: auth.user.id, reviewedAt: new Date() },
    })
    await audit(auth.user, `AGENT_${data.decision}`, "AGENT", agent.id, { reason: data.reason ?? null })
    const titles: Record<string, string> = { APPROVE: "تأیید همکاری فروش", REJECT: "رد درخواست همکاری", SUSPEND: "تعلیق همکاری", START_REVIEW: "آغاز بررسی درخواست" }
    const bodies: Record<string, string> = {
      APPROVE: "درخواست همکاری فروش شما تأیید شد؛ از این پس می‌توانید مشتری ثبت کنید و روند فروش را پیگیری کنید.",
      REJECT: `درخواست همکاری شما رد شد. دلیل: ${data.reason}`,
      SUSPEND: `همکاری شما به‌طور موقت تعلیق شد. دلیل: ${data.reason}`,
      START_REVIEW: "درخواست همکاری شما در حال بررسی توسط کارشناسان است.",
    }
    await notify(agent.userId, titles[data.decision], bodies[data.decision], data.decision === "APPROVE" ? "SUCCESS" : "INFO")
    return ok({ updated: true, status })
  }

  // update_profile — مشاهده / ویرایش اطلاعات (دکمهٔ «عملیات»)
  if (data.action === "update_profile") {
    const agent = await db.agent.findUnique({ where: { id: data.agentId } })
    if (!agent) return fail("نماینده یافت نشد.", 404)
    if (!isValidProvinceCity(data.province ?? null, data.city ?? null)) {
      return fail("استان یا شهر انتخاب‌شده معتبر نیست.", 422)
    }
    await db.agent.update({
      where: { id: agent.id },
      data: {
        businessName: data.businessName,
        description: data.description,
        phone: data.phone,
        province: data.province,
        city: data.city,
      },
    })

    // نام و نام خانوادگی روی پروفایل کاربر نماینده (پروفایل ممکن است هنوز ساخته نشده باشد)
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const profile = await db.userProfile.findUnique({ where: { userId: agent.userId } })
      const nameData = {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      }
      if (profile) {
        await db.userProfile.update({ where: { userId: agent.userId }, data: nameData })
      } else {
        await db.userProfile.create({ data: { userId: agent.userId, ...nameData } })
      }
    }

    await audit(auth.user, "AGENT_PROFILE_UPDATE", "AGENT", agent.id, {
      firstName: data.firstName,
      lastName: data.lastName,
      businessName: data.businessName,
      description: data.description,
      phone: data.phone,
      province: data.province,
      city: data.city,
    })
    return ok({ updated: true })
  }

  // review_document (AGENT-004/007/010)
  const doc = await db.agentDocument.findUnique({ where: { id: data.documentId }, include: { agent: { include: { user: true } } } })
  if (!doc) return fail("مدرک یافت نشد.", 404)
  if (data.decision === "REJECT" && (data.reason ?? "").trim().length < 3) {
    return fail("برای رد مدرک، ثبت دلیل الزامی است.", 422)
  }
  await db.agentDocument.update({
    where: { id: doc.id },
    data: {
      status: data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
      rejectReason: data.decision === "REJECT" ? data.reason : null,
      reviewedById: auth.user.id,
      reviewedAt: new Date(),
    },
  })
  await audit(auth.user, `AGENT_DOC_${data.decision}`, "AGENT_DOCUMENT", doc.id, { reason: data.reason ?? null })
  await notify(
    doc.agent.userId,
    data.decision === "APPROVE" ? "تأیید مدرک" : "رد مدرک",
    data.decision === "APPROVE"
      ? `مدرک «${doc.docType === "NATIONAL_CARD" ? "کارت ملی" : doc.docType === "BUSINESS_LICENSE" ? "مجوز فعالیت" : "مدرک"}» شما تأیید شد.`
      : `مدرک شما رد شد. دلیل: ${data.reason}`,
    data.decision === "APPROVE" ? "SUCCESS" : "WARNING"
  )
  return ok({ updated: true })
}
