import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"
import { applyWalletTx } from "@/lib/wallet"

// تأیید/رد پورسانت (ADMIN-017/018 · REF-006..009 · BR-13/14)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("commissions.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const type = sp.get("type") ?? ""
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 15

  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(q ? { beneficiary: { OR: [{ mobile: { contains: q } }, { profile: { firstName: { contains: q } } }, { profile: { lastName: { contains: q } } }] } } : {}),
  }

  const [total, commissions, sums] = await Promise.all([
    db.commission.count({ where }),
    db.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        beneficiary: { select: { mobile: true, profile: { select: { firstName: true, lastName: true } } } },
        plan: { select: { title: true } },
        sourceSale: { select: { holder: { select: { firstName: true, lastName: true } } } },
        sourcePurchase: { select: { holder: { select: { firstName: true, lastName: true } } } },
      },
    }),
    db.commission.groupBy({ by: ["status"], _sum: { amount: true }, _count: true }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    byStatus: sums.map((s) => ({ status: s.status, total: s._sum.amount ?? 0, count: s._count })),
    commissions: commissions.map((c) => ({
      id: c.id,
      type: c.type,
      beneficiary: `${c.beneficiary.profile?.firstName ?? ""} ${c.beneficiary.profile?.lastName ?? ""}`.trim() || c.beneficiary.mobile,
      beneficiaryMobile: c.beneficiary.mobile,
      planTitle: c.plan.title,
      customer: c.sourceSale
        ? `${c.sourceSale.holder.firstName} ${c.sourceSale.holder.lastName}`
        : c.sourcePurchase
          ? `${c.sourcePurchase.holder.firstName} ${c.sourcePurchase.holder.lastName}`
          : null,
      baseAmount: c.baseAmount,
      percent: c.percent,
      amount: c.amount,
      status: c.status,
      description: c.description,
      createdAt: c.createdAt,
      approvedAt: c.approvedAt,
    })),
  })
}

const actionSchema = z.object({
  commissionId: z.string(),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission("commissions.review")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, actionSchema)
  if ("response" in parsed) return parsed.response
  const { commissionId, decision, reason } = parsed.data

  if (decision === "REJECT" && (reason ?? "").trim().length < 3) {
    return fail("برای رد پورسانت، ثبت دلیل الزامی است.", 422)
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const commission = await tx.commission.findUnique({ where: { id: commissionId }, include: { beneficiary: true } })
      if (!commission) throw new Error("NOT_FOUND")
      if (commission.status !== "PENDING") throw new Error("NOT_PENDING")

      if (decision === "APPROVE") {
        // تأیید = افزایش اتمیک موجودی قابل برداشت (WALLET-002 · REF-006 · WALLET-006 idempotent)
        await applyWalletTx(tx, commission.beneficiaryUserId, "COMMISSION_CREDIT", commission.amount, {
          refType: "COMMISSION",
          refId: commission.id,
          note: `تأیید پورسانت ${commission.type === "SALE" ? "فروش" : "معرفی"}`,
          createdBy: auth.user.id,
          idempotencyKey: `commission:${commission.id}:credit`,
        })
        const updated = await tx.commission.update({
          where: { id: commission.id, status: "PENDING" },
          data: { status: "APPROVED", approvedById: auth.user.id, approvedAt: new Date(), rejectReason: null },
        })
        if (!updated) throw new Error("NOT_PENDING")
      } else {
        await tx.commission.update({
          where: { id: commission.id, status: "PENDING" },
          data: { status: "CANCELLED", rejectReason: reason, approvedById: auth.user.id, approvedAt: new Date() },
        })
      }
      return commission
    })

    const title = decision === "APPROVE" ? "تأیید پورسانت" : "رد پورسانت"
    const body =
      decision === "APPROVE"
        ? `پورسانت ${result.type === "SALE" ? "فروش" : "معرفی"} شما به مبلغ ${result.amount.toLocaleString("en-US").replace(/,/g, "،")} تومان تأیید و به مانده قابل برداشت افزوده شد.`
        : `پورسانت شما رد شد. دلیل: ${reason}`
    await notify(result.beneficiaryUserId, title, body, decision === "APPROVE" ? "SUCCESS" : "WARNING", "/agent/commissions")
    await audit(auth.user, `COMMISSION_${decision}`, "COMMISSION", commissionId, { reason: reason || null })
    return ok({ updated: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const map: Record<string, string> = {
      NOT_FOUND: "پورسانت یافت نشد.",
      NOT_PENDING: "این پورسانت قبلاً تعیین تکلیف شده است.",
    }
    if (msg in map) return fail(map[msg], 409)
    console.error("[COMMISSION_ACTION_FAIL]", e)
    return fail("خطا در انجام عملیات.", 500)
  }
}
