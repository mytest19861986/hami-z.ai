import { ok, requireUser } from "@/lib/api"
import { db } from "@/lib/db"

// سوابق ویزیت دارندگان مرتبط با کاربر (USER-005 · VISIT-011)
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const visits = await db.visit.findMany({
    where: {
      membership: {
        OR: [{ buyerUserId: auth.user.id }, { holder: { createdByUserId: auth.user.id } }],
      },
    },
    include: {
      doctor: {
        select: {
          specialty: true,
          clinicName: true,
          user: { select: { profile: { select: { firstName: true, lastName: true } } } },
        },
      },
      holder: { select: { firstName: true, lastName: true } },
      membership: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return ok(
    visits.map((v) => ({
      id: v.id,
      holder: `${v.holder.firstName} ${v.holder.lastName}`,
      doctorName: `${v.doctor.user.profile?.firstName ?? ""} ${v.doctor.user.profile?.lastName ?? ""}`.trim(),
      specialty: v.doctor.specialty,
      clinicName: v.doctor.clinicName,
      visitDate: v.visitDate,
      totalAmount: v.totalAmount,
      discountPercent: v.discountPercent,
      discountAmount: v.discountAmount,
      finalAmount: v.finalAmount,
      status: v.status,
    }))
  )
}
