import { ok, requireUser } from "@/lib/api"
import { db } from "@/lib/db"

// وضعیت درخواست و پروفایل پزشک (DOCTOR-DASH-002/006)
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const doctor = await db.doctor.findUnique({
    where: { userId: auth.user.id },
    include: { _count: { select: { visits: true } } },
  })
  if (!doctor) return ok(null)
  return ok({
    id: doctor.id,
    medicalCouncilCode: doctor.medicalCouncilCode,
    specialty: doctor.specialty,
    clinicName: doctor.clinicName,
    clinicAddress: doctor.clinicAddress,
    province: doctor.province,
    city: doctor.city,
    clinicPhone: doctor.clinicPhone,
    bio: doctor.bio,
    avatarUrl: doctor.avatarUrl, // عکس پروفایل پزشک (DOCTOR-DASH-007)
    discountPercent: doctor.discountPercent,
    status: doctor.status,
    rejectReason: doctor.rejectReason,
    reviewedAt: doctor.reviewedAt,
    visitsCount: doctor._count.visits,
  })
}
