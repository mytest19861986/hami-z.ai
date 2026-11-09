import { NextRequest } from "next/server"
import { ok, requirePermission } from "@/lib/api"
import { db } from "@/lib/db"

// مشاهده همه ویزیت‌ها (ADMIN · REPORT-004 · CONTRACT-004)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("visits.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const doctorId = sp.get("doctorId") ?? ""
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 20

  const where = {
    ...(status ? { status } : {}),
    ...(doctorId ? { doctorId } : {}),
    ...(q ? {
      OR: [
        { holder: { firstName: { contains: q } } },
        { holder: { lastName: { contains: q } } },
        { holder: { nationalCode: { contains: q } } },
        { doctor: { user: { profile: { firstName: { contains: q } } } } },
        { doctor: { user: { profile: { lastName: { contains: q } } } } },
      ],
    } : {}),
  }

  const [total, visits, sumAgg] = await Promise.all([
    db.visit.count({ where }),
    db.visit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        doctor: { select: { specialty: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        holder: { select: { firstName: true, lastName: true, nationalCode: true } },
        membership: { select: { plan: { select: { title: true } } } },
      },
    }),
    db.visit.aggregate({ where, _sum: { discountAmount: true, finalAmount: true } }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    totals: { discount: sumAgg._sum.discountAmount ?? 0, final: sumAgg._sum.finalAmount ?? 0 },
    visits: visits.map((v) => ({
      id: v.id,
      holder: `${v.holder.firstName} ${v.holder.lastName}`,
      holderNationalCode: v.holder.nationalCode,
      doctor: `${v.doctor.user.profile?.firstName ?? ""} ${v.doctor.user.profile?.lastName ?? ""}`.trim(),
      specialty: v.doctor.specialty,
      planTitle: v.membership.plan.title,
      visitDate: v.visitDate,
      totalAmount: v.totalAmount,
      discountPercent: v.discountPercent,
      discountBase: v.discountBase,
      discountAmount: v.discountAmount,
      finalAmount: v.finalAmount,
      status: v.status,
      createdAt: v.createdAt,
    })),
  })
}
