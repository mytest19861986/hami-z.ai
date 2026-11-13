import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
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
      review: { select: { id: true, rating: true, comment: true, status: true, createdAt: true } },
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
      // نظر ثبت‌شده برای این ویزیت (REVIEW-001/002) — برای دکمهٔ «ثبت نظر» در UI
      review: v.review ? { rating: v.review.rating, comment: v.review.comment, status: v.review.status } : null,
    }))
  )
}

// ثبت نظر و امتیاز (ستاره) برای یک ویزیت (REVIEW-001/002)
// هر ویزیت فقط یک نظر دارد (unique)؛ نظر ابتدا PENDING است و پس از تأیید ادمین منتشر می‌شود.
const reviewSchema = z.object({
  visitId: z.string().min(1),
  rating: z.number().int().min(1, "امتیاز بین ۱ تا ۵ ستاره است.").max(5, "امتیاز بین ۱ تا ۵ ستاره است."),
  comment: z.string().trim().max(500, "متن نظر حداکثر ۵۰۰ نویسه است.").optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, reviewSchema)
  if ("response" in parsed) return parsed.response
  const { visitId, rating, comment } = parsed.data

  try {
    const review = await db.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        include: { membership: { select: { buyerUserId: true } }, holder: { select: { createdByUserId: true } } },
      })
      if (!visit) throw new Error("VISIT_NOT_FOUND")

      // فقط خریدار طرح یا کاربر سازندهٔ دارنده می‌تواند برای این ویزیت نظر ثبت کند
      const isAllowed = visit.membership.buyerUserId === auth.user.id || visit.holder.createdByUserId === auth.user.id
      if (!isAllowed) throw new Error("FORBIDDEN")

      // یک ویزیت = یک نظر (ویرایش مجدد با جایگزینی وضعیت به PENDING)
      const existing = await tx.doctorReview.findUnique({ where: { visitId } })
      if (existing) throw new Error("ALREADY_REVIEWED")

      return tx.doctorReview.create({
        data: {
          visitId,
          doctorId: visit.doctorId,
          authorUserId: auth.user.id,
          rating,
          comment: comment || null,
          status: "PENDING",
        },
      })
    })

    return ok({ reviewId: review.id, status: review.status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const map: Record<string, string> = {
      VISIT_NOT_FOUND: "ویزیت یافت نشد.",
      FORBIDDEN: "فقط دارنده یا خریدار طرح می‌تواند برای این ویزیت نظر ثبت کند.",
      ALREADY_REVIEWED: "برای این ویزیت قبلاً نظر ثبت کرده‌اید.",
    }
    if (msg in map) return fail(map[msg], msg === "ALREADY_REVIEWED" ? 409 : msg === "FORBIDDEN" ? 403 : 404)
    console.error("[USER_VISIT_REVIEW_FAIL]", e)
    return fail("خطا در ثبت نظر.", 500)
  }
}
