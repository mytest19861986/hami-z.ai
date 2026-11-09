import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"
import { applyWalletTx } from "@/lib/wallet"
import { maskCard, maskSheba } from "@/lib/validators"

// مدیریت تسویه‌ها (ADMIN-019/020 · SETTLE-007..017 · AC-12 · BR-20..23)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("settlements.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 15

  const where = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ user: { mobile: { contains: q } } }, { trackingCode: { contains: q } }, { user: { profile: { firstName: { contains: q } } } }, { user: { profile: { lastName: { contains: q } } } }] } : {}),
  }

  const [total, settlements] = await Promise.all([
    db.settlementRequest.count({ where }),
    db.settlementRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { mobile: true, profile: { select: { firstName: true, lastName: true } } } } },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    settlements: settlements.map((s) => ({
      id: s.id,
      applicant: `${s.user.profile?.firstName ?? ""} ${s.user.profile?.lastName ?? ""}`.trim() || s.user.mobile,
      applicantMobile: s.user.mobile,
      amount: s.amount,
      status: s.status,
      trackingCode: s.trackingCode,
      bankCardNumber: s.bankCardNumber,
      bankSheba: s.bankSheba,
      bankAccountName: s.bankAccountName,
      reviewNote: s.reviewNote,
      paymentTrackingCode: s.paymentTrackingCode,
      paymentNote: s.paymentNote,
      createdAt: s.createdAt,
      reviewedAt: s.reviewedAt,
      paidAt: s.paidAt,
    })),
  })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    settlementId: z.string(),
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(300).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("mark_paid"),
    settlementId: z.string(),
    paymentTrackingCode: z.string().trim().min(3, "کد پیگیری پرداخت الزامی است.").max(60),
    note: z.string().trim().max(300).optional().or(z.literal("")),
  }),
])

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, actionSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  // ثبت پرداخت = عمل حساس؛ فقط مدیر ارشد (ADMIN-020 · SETTLE-008/009 · OPEN-04)
  if (data.action === "mark_paid") {
    const auth = await requirePermission("settlements.mark_paid")
    if ("response" in auth) return auth.response

    try {
      const result = await db.$transaction(async (tx) => {
        const s = await tx.settlementRequest.findUnique({ where: { id: data.settlementId } })
        if (!s) throw new Error("NOT_FOUND")
        if (s.status !== "APPROVED") throw new Error("NOT_APPROVED")

        // خروج مبلغ از نگهداشت (SETTLE-10 · WALLET-005)
        await applyWalletTx(tx, s.userId, "SETTLE_PAID", s.amount, {
          refType: "SETTLEMENT",
          refId: s.id,
          note: `ثبت پرداخت تسویه ${s.trackingCode}`,
          createdBy: auth.user.id,
        })

        // تخصیص FIFO پورسانت‌های تأییدشده به این تسویه (REF-007 · REPORT-006)
        let remaining = s.amount
        const commissions = await tx.commission.findMany({
          where: { beneficiaryUserId: s.userId, status: "APPROVED", settlementId: null },
          orderBy: { approvedAt: "asc" },
        })
        for (const c of commissions) {
          if (remaining <= 0) break
          if (c.amount <= remaining) {
            await tx.commission.update({ where: { id: c.id }, data: { status: "PAID", settlementId: s.id } })
            remaining -= c.amount
          }
        }

        const updated = await tx.settlementRequest.update({
          where: { id: s.id },
          data: {
            status: "PAID",
            paidById: auth.user.id,
            paidAt: new Date(),
            paymentTrackingCode: data.paymentTrackingCode,
            paymentNote: data.note || null,
          },
        })
        return { settlement: updated, maskedCard: maskCard(s.bankCardNumber), maskedSheba: maskSheba(s.bankSheba) }
      })

      await notify(
        result.settlement.userId,
        "تسویه پرداخت شد",
        `درخواست تسویه ${result.settlement.trackingCode} به مبلغ ${result.settlement.amount.toLocaleString("en-US").replace(/,/g, "،")} تومان به‌عنوان پرداخت‌شده ثبت شد. کد پیگیری پرداخت: ${data.paymentTrackingCode}`,
        "SUCCESS",
        "/agent/settlements"
      )
      await audit(auth.user, "SETTLEMENT_MARK_PAID", "SETTLEMENT", data.settlementId, { paymentTrackingCode: data.paymentTrackingCode, amount: result.settlement.amount })
      return ok({ updated: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      const map: Record<string, string> = { NOT_FOUND: "درخواست یافت نشد.", NOT_APPROVED: "فقط درخواست تأییدشده قابل ثبت پرداخت است." }
      if (msg in map) return fail(map[msg], 409)
      console.error("[SETTLEMENT_PAID_FAIL]", e)
      return fail("خطا در ثبت پرداخت.", 500)
    }
  }

  // review (تأیید/رد) — مدیر با مجوز settlements.review
  const auth = await requirePermission("settlements.review")
  if ("response" in auth) return auth.response

  if (data.decision === "REJECT" && (data.note ?? "").trim().length < 3) {
    return fail("برای رد درخواست، ثبت دلیل الزامی است.", 422)
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const s = await tx.settlementRequest.findUnique({ where: { id: data.settlementId } })
      if (!s) throw new Error("NOT_FOUND")
      if (s.status !== "PENDING") throw new Error("NOT_PENDING")

      if (data.decision === "APPROVE") {
        await tx.settlementRequest.update({
          where: { id: s.id },
          data: { status: "APPROVED", reviewedById: auth.user.id, reviewedAt: new Date(), reviewNote: data.note || null },
        })
      } else {
        // رد → آزادسازی مبلغ نگه‌داشته‌شده (SETTLE-12 · BR-23)
        await applyWalletTx(tx, s.userId, "RELEASE", s.amount, {
          refType: "SETTLEMENT",
          refId: s.id,
          note: `آزادسازی بابت رد درخواست تسویه ${s.trackingCode}`,
          createdBy: auth.user.id,
        })
        await tx.settlementRequest.update({
          where: { id: s.id },
          data: { status: "REJECTED", reviewedById: auth.user.id, reviewedAt: new Date(), reviewNote: data.note || null },
        })
      }
      return s
    })

    await notify(
      result.userId,
      data.decision === "APPROVE" ? "تأیید درخواست تسویه" : "رد درخواست تسویه",
      data.decision === "APPROVE"
        ? `درخواست تسویه ${result.trackingCode} تأیید شد؛ پرداخت خارج از سامانه انجام و ثبت می‌شود.`
        : `درخواست تسویه ${result.trackingCode} رد شد و مبلغ به مانده قابل برداشت بازگشت. دلیل: ${data.note}`,
      data.decision === "APPROVE" ? "SUCCESS" : "WARNING",
      "/agent/settlements"
    )
    await audit(auth.user, `SETTLEMENT_${data.decision}`, "SETTLEMENT", data.settlementId, { note: data.note || null })
    return ok({ updated: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const map: Record<string, string> = { NOT_FOUND: "درخواست یافت نشد.", NOT_PENDING: "این درخواست قبلاً بررسی شده است." }
    if (msg in map) return fail(map[msg], 409)
    console.error("[SETTLEMENT_REVIEW_FAIL]", e)
    return fail("خطا در بررسی درخواست.", 500)
  }
}
