import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"
import { commissionAmount } from "@/lib/format"

// بررسی و تأیید خریدها (PAY-005/009/010 · ADMIN-013 · AC-05/06)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("purchases.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 15

  const where = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ trackingCode: { contains: q } }, { buyer: { mobile: { contains: q } } }] } : {}),
  }

  const [total, purchases] = await Promise.all([
    db.purchase.count({ where }),
    db.purchase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        plan: { select: { title: true, durationDays: true, referralCommissionPercent: true } },
        buyer: { select: { mobile: true, profile: { select: { firstName: true, lastName: true } } } },
        holder: { select: { firstName: true, lastName: true, nationalCode: true } },
        membership: { select: { id: true } },
      },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    purchases: purchases.map((p) => ({
      id: p.id,
      trackingCode: p.trackingCode,
      planTitle: p.plan.title,
      buyer: `${p.buyer.profile?.firstName ?? ""} ${p.buyer.profile?.lastName ?? ""}`.trim() || p.buyer.mobile,
      buyerMobile: p.buyer.mobile,
      holder: `${p.holder.firstName} ${p.holder.lastName}`,
      holderNationalCode: p.holder.nationalCode,
      amount: p.amount,
      referrerMobile: p.referrerMobile,
      status: p.status,
      rejectReason: p.rejectReason,
      hasMembership: !!p.membership,
      createdAt: p.createdAt,
      approvedAt: p.approvedAt,
    })),
  })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    purchaseId: z.string(),
    note: z.string().trim().max(300).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("reject"),
    purchaseId: z.string(),
    reason: z.string().trim().min(3, "دلیل رد الزامی است.").max(300),
  }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission("purchases.review")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, actionSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  try {
    if (data.action === "approve") {
      const result = await db.$transaction(async (tx) => {
        const purchase = await tx.purchase.findUnique({
          where: { id: data.purchaseId },
          include: { plan: true, holder: true },
        })
        if (!purchase) throw new Error("NOT_FOUND")
        // فقط درخواست در انتظار تأیید می‌شود؛ تکرار تأیید اثری ندارد (PAY-006 · AC-06)
        if (purchase.status !== "PENDING") throw new Error("NOT_PENDING")

        // یک خرید موفق = دقیقاً یک عضویت (PAY-006)
        const existingMembership = await tx.membership.findUnique({ where: { purchaseId: purchase.id } })
        if (existingMembership) throw new Error("ALREADY_HAS_MEMBERSHIP")

        const now = new Date()
        const membership = await tx.membership.create({
          data: {
            planId: purchase.planId,
            holderId: purchase.holderId,
            buyerUserId: purchase.buyerUserId,
            originType: "PURCHASE",
            purchaseId: purchase.id,
            startDate: now,
            endDate: new Date(now.getTime() + purchase.plan.durationDays * 86400000),
            status: "ACTIVE",
            usageLimit: purchase.plan.usageLimit,
          },
        })

        await tx.purchase.update({
          where: { id: purchase.id },
          data: { status: "SUCCESS", approvedById: auth.user.id, approvedAt: now, rejectReason: null },
        })

        // پورسانت معرفی — فقط اگر معرف معتبر با نقش همکار معرفی وجود داشته باشد (REF-005 · OPEN-05)
        let referrerToNotify: { id: string; percent: number } | null = null
        if (purchase.referrerMobile) {
          const referrer = await tx.user.findFirst({
            where: { mobile: purchase.referrerMobile, status: "ACTIVE", roles: { some: { role: { name: "REFERRER" } } } },
          })
          if (referrer) {
            const existingCommission = await tx.commission.findUnique({ where: { sourcePurchaseId: purchase.id } })
            if (!existingCommission && purchase.plan.referralCommissionPercent > 0) {
              await tx.commission.create({
                data: {
                  beneficiaryUserId: referrer.id,
                  type: "REFERRAL",
                  planId: purchase.planId,
                  baseAmount: purchase.amount,
                  percent: purchase.plan.referralCommissionPercent,
                  amount: commissionAmount(purchase.amount, purchase.plan.referralCommissionPercent),
                  status: "PENDING",
                  sourcePurchaseId: purchase.id,
                  description: `پورسانت معرفی خرید ${purchase.trackingCode}`,
                },
              })
              // اعلان پس از commit ارسال می‌شود (نوشتن با کلاینت سراسری داخل تراکنش، بن‌بست SQLite می‌سازد)
              referrerToNotify = { id: referrer.id, percent: purchase.plan.referralCommissionPercent }
            }
          }
        }

        return { purchase, membership, referrerToNotify }
      })

      await audit(auth.user, "PURCHASE_APPROVE", "PURCHASE", result.purchase.id, { note: data.note || null })
      await notify(
        result.purchase.buyerUserId,
        "خرید تأیید و طرح فعال شد",
        `درخواست خرید «${result.purchase.plan.title}» با کد پیگیری ${result.purchase.trackingCode} تأیید شد و طرح برای دارنده فعال گردید.`,
        "SUCCESS",
        "/user/memberships"
      )
      if (result.referrerToNotify) {
        await notify(
          result.referrerToNotify.id,
          "پورسانت معرفی ثبت شد",
          `برای خریدی که معرفی کرده بودید، پورسانت ${result.referrerToNotify.percent}٪ ثبت و در انتظار تأیید است.`,
          "INFO",
          "/agent/commissions"
        )
      }
      return ok({ membershipId: result.membership.id })
    }

    // reject
    const purchase = await db.purchase.findUnique({ where: { id: data.purchaseId } })
    if (!purchase) return fail("درخواست خرید یافت نشد.", 404)
    if (purchase.status !== "PENDING") return fail("فقط درخواست در وضعیت «در انتظار» قابل رد است.", 409)

    await db.purchase.update({
      where: { id: purchase.id },
      data: { status: "FAILED", rejectReason: data.reason, approvedById: auth.user.id, approvedAt: new Date() },
    })
    await audit(auth.user, "PURCHASE_REJECT", "PURCHASE", purchase.id, { reason: data.reason })
    await notify(purchase.buyerUserId, "رد درخواست خرید", `درخواست خرید با کد پیگیری ${purchase.trackingCode} رد شد. دلیل: ${data.reason}`, "WARNING", "/user/purchases")
    return ok({ updated: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const map: Record<string, string> = {
      NOT_FOUND: "درخواست خرید یافت نشد.",
      NOT_PENDING: "این درخواست قبلاً تعیین تکلیف شده است.",
      ALREADY_HAS_MEMBERSHIP: "برای این خرید قبلاً عضویت ثبت شده است.",
    }
    if (msg in map) return fail(map[msg], 409)
    console.error("[PURCHASE_ACTION_FAIL]", e)
    return fail("خطا در انجام عملیات.", 500)
  }
}
