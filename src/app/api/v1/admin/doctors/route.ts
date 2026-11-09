import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"

// مدیریت پزشکان (ADMIN-007..010 · DOC-009/010/014 · AC-02)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("doctors.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const specialty = sp.get("specialty") ?? ""
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 15

  const where = {
    ...(status ? { status } : {}),
    ...(specialty ? { specialty } : {}),
    ...(q
      ? {
          OR: [
            { user: { profile: { firstName: { contains: q } } } },
            { user: { profile: { lastName: { contains: q } } } },
            { medicalCouncilCode: { contains: q } },
            { clinicName: { contains: q } },
          ],
        }
      : {}),
  }

  const [total, doctors] = await Promise.all([
    db.doctor.count({ where }),
    db.doctor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        user: { select: { id: true, mobile: true, profile: { select: { firstName: true, lastName: true } } } },
        _count: { select: { visits: true } },
      },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    doctors: doctors.map((d) => ({
      id: d.id,
      userId: d.user.id,
      name: `${d.user.profile?.firstName ?? ""} ${d.user.profile?.lastName ?? ""}`.trim() || "—",
      mobile: d.user.mobile,
      medicalCouncilCode: d.medicalCouncilCode,
      specialty: d.specialty,
      clinicName: d.clinicName,
      clinicAddress: d.clinicAddress,
      province: d.province,
      city: d.city,
      clinicPhone: d.clinicPhone,
      bio: d.bio,
      discountPercent: d.discountPercent,
      status: d.status,
      rejectReason: d.rejectReason,
      isPublic: d.isPublic,
      visitsCount: d._count.visits,
      createdAt: d.createdAt,
    })),
  })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    doctorId: z.string(),
    decision: z.enum(["APPROVE", "REJECT", "SUSPEND"]),
    reason: z.string().trim().max(400).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("set_discount"),
    doctorId: z.string(),
    discountPercent: z.number().int().min(1, "درصد تخفیف باید بین ۱ تا ۹۰ باشد.").max(90).nullable(),
  }),
  z.object({
    action: z.literal("set_public"),
    doctorId: z.string(),
    isPublic: z.boolean(),
  }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission("doctors.review")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, actionSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  const doctor = await db.doctor.findUnique({ where: { id: data.doctorId }, include: { user: true } })
  if (!doctor) return fail("پزشک یافت نشد.", 404)

  if (data.action === "review") {
    const map = {
      APPROVE: { status: "APPROVED", needsReason: false },
      REJECT: { status: "REJECTED", needsReason: true },
      SUSPEND: { status: "SUSPENDED", needsReason: true },
    } as const
    const m = map[data.decision]
    const reason = data.reason || ""
    if (m.needsReason && reason.trim().length < 3) {
      return fail("برای رد یا تعلیق، ثبت دلیل الزامی است.", 422)
    }
    if (doctor.status === m.status) return fail("وضعیت پزشک هم‌اکنون همین است.", 409)

    await db.doctor.update({
      where: { id: doctor.id },
      data: { status: m.status, rejectReason: m.needsReason ? reason : null, reviewedById: auth.user.id, reviewedAt: new Date() },
    })
    await audit(auth.user, `DOCTOR_${data.decision}`, "DOCTOR", doctor.id, { reason })
    const titles: Record<string, string> = { APPROVE: "تأیید درخواست پزشکی", REJECT: "رد درخواست پزشکی", SUSPEND: "تعلیق همکاری" }
    const bodies: Record<string, string> = {
      APPROVE: "درخواست همکاری پزشکی شما تأیید شد؛ از این پس می‌توانید داشبورد پزشک و ثبت ویزیت را استفاده کنید.",
      REJECT: `درخواست همکاری پزشکی شما رد شد. دلیل: ${reason}`,
      SUSPEND: `همکاری پزشکی شما به‌طور موقت تعلیق شد. دلیل: ${reason}`,
    }
    await notify(doctor.userId, titles[data.decision], bodies[data.decision], data.decision === "APPROVE" ? "SUCCESS" : "WARNING")
    return ok({ updated: true, status: m.status })
  }

  if (data.action === "set_discount") {
    // DOC-012: درصد تخفیف اختصاصی فقط توسط مدیر تعیین می‌شود
    await db.doctor.update({ where: { id: doctor.id }, data: { discountPercent: data.discountPercent } })
    await audit(auth.user, "DOCTOR_DISCOUNT_SET", "DOCTOR", doctor.id, { discountPercent: data.discountPercent })
    return ok({ updated: true })
  }

  // set_public (DOC-006 · ADMIN-010)
  await db.doctor.update({ where: { id: doctor.id }, data: { isPublic: data.isPublic } })
  await audit(auth.user, "DOCTOR_PUBLICITY_SET", "DOCTOR", doctor.id, { isPublic: data.isPublic })
  return ok({ updated: true })
}
