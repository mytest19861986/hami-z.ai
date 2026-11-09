import { NextRequest } from "next/server"
import { ok } from "@/lib/api"
import { db } from "@/lib/db"
import { PROVINCE_NAMES } from "@/constants/geo"
import { SPECIALTIES } from "@/constants/specialties"

// جست‌وجوی پزشکان تأییدشده (DOC-001..004: تأییدنشده/تعلیقی نمایش داده نمی‌شوند)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const q = (sp.get("q") ?? "").trim()
  const specialty = sp.get("specialty") ?? ""
  const province = sp.get("province") ?? ""
  const city = sp.get("city") ?? ""
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 12

  const where = {
    status: "APPROVED",
    isPublic: true,
    ...(specialty ? { specialty } : {}),
    ...(province ? { province } : {}),
    ...(city ? { city } : {}),
    ...(q
      ? {
          OR: [
            { user: { profile: { firstName: { contains: q } } } },
            { user: { profile: { lastName: { contains: q } } } },
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
      select: {
        id: true,
        specialty: true,
        clinicName: true,
        province: true,
        city: true,
        clinicPhone: true,
        bio: true,
        discountPercent: true,
        user: { select: { profile: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ])

  return ok({
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    doctors: doctors.map((d) => ({
      id: d.id,
      name: `${d.user.profile?.firstName ?? ""} ${d.user.profile?.lastName ?? ""}`.trim() || "پزشک",
      specialty: d.specialty,
      clinicName: d.clinicName,
      province: d.province,
      city: d.city,
      clinicPhone: d.clinicPhone,
      bio: d.bio,
      discountPercent: d.discountPercent,
    })),
    meta: { specialties: SPECIALTIES, provinces: PROVINCE_NAMES },
  })
}
