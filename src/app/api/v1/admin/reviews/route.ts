import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"

// مدیریت نظرات پزشکان (REVIEW-003/004 · P1)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("reviews.moderate")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 15

  const where = { ...(status ? { status } : {}) }
  const [total, reviews] = await Promise.all([
    db.doctorReview.count({ where }),
    db.doctorReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        doctor: { select: { specialty: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        author: { select: { mobile: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    reviews: reviews.map((r) => ({
      id: r.id,
      doctor: `${r.doctor.user.profile?.firstName ?? ""} ${r.doctor.user.profile?.lastName ?? ""}`.trim(),
      specialty: r.doctor.specialty,
      author: `${r.author.profile?.firstName ?? ""} ${r.author.profile?.lastName ?? ""}`.trim() || r.author.mobile,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      createdAt: r.createdAt,
    })),
  })
}

const schema = z.object({
  reviewId: z.string(),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission("reviews.moderate")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, schema)
  if ("response" in parsed) return parsed.response
  const { reviewId, decision, reason } = parsed.data

  if (decision === "REJECT" && (reason ?? "").trim().length < 3) return fail("برای رد نظر، دلیل الزامی است.", 422)

  const review = await db.doctorReview.findUnique({ where: { id: reviewId } })
  if (!review) return fail("نظر یافت نشد.", 404)
  if (review.status !== "PENDING") return fail("این نظر قبلاً تعیین تکلیف شده است.", 409)

  await db.doctorReview.update({
    where: { id: reviewId },
    data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", rejectReason: decision === "REJECT" ? reason : null, reviewedById: auth.user.id, reviewedAt: new Date() },
  })
  await audit(auth.user, `REVIEW_${decision}`, "DOCTOR_REVIEW", reviewId, { reason: reason || null })
  return ok({ updated: true })
}
