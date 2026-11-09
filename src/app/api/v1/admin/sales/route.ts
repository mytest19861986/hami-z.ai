import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"
import { commissionAmount } from "@/lib/format"

// چرخه فروش و کارت (SALE-004..013 · ADMIN-015/016 · AC-09/10 · BR-11/12)
const SALE_TRANSITIONS: Record<string, string[]> = {
  PENDING_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["CARD_ISSUED"],
  CARD_ISSUED: ["SENT"],
  SENT: ["DELIVERED"],
  DELIVERED: ["PAYMENT_REGISTERED"],
  PAYMENT_REGISTERED: ["FINALIZED"],
  FINALIZED: ["RETURNED"],
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission("sales.view_all")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const status = sp.get("status") ?? ""
  const q = (sp.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 15

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { holder: { firstName: { contains: q } } },
            { holder: { lastName: { contains: q } } },
            { holder: { nationalCode: { contains: q } } },
            { agent: { user: { mobile: { contains: q } } } },
          ],
        }
      : {}),
  }

  const [total, sales] = await Promise.all([
    db.saleCustomer.count({ where }),
    db.saleCustomer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        agent: { include: { user: { select: { mobile: true, profile: { select: { firstName: true, lastName: true } } } } } },
        holder: { select: { firstName: true, lastName: true, nationalCode: true, mobile: true } },
        plan: { select: { title: true, price: true, durationDays: true, salesCommissionPercent: true } },
        membership: { select: { id: true } },
      },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    sales: sales.map((s) => ({
      id: s.id,
      agentName: `${s.agent.user.profile?.firstName ?? ""} ${s.agent.user.profile?.lastName ?? ""}`.trim() || s.agent.user.mobile,
      agentMobile: s.agent.user.mobile,
      holder: `${s.holder.firstName} ${s.holder.lastName}`,
      holderNationalCode: s.holder.nationalCode,
      holderMobile: s.holder.mobile,
      planTitle: s.plan.title,
      planPrice: s.plan.price,
      status: s.status,
      address: s.address,
      postalCode: s.postalCode,
      cardNumber: s.cardNumber,
      paymentAmount: s.paymentAmount,
      paymentDate: s.paymentDate,
      paymentTrackingCode: s.paymentTrackingCode,
      paymentNote: s.paymentNote,
      rejectReason: s.rejectReason,
      returnReason: s.returnReason,
      hasMembership: !!s.membership,
      createdAt: s.createdAt,
      deliveredAt: s.deliveredAt,
      finalizedAt: s.finalizedAt,
      nextTransitions: SALE_TRANSITIONS[s.status] ?? [],
    })),
  })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("transition"), saleId: z.string(), to: z.enum(["APPROVED", "CARD_ISSUED", "SENT", "DELIVERED", "FINALIZED"]), reason: z.string().trim().max(300).optional().or(z.literal("")), cardNumber: z.string().trim().max(40).optional().or(z.literal("")) }),
  z.object({ action: z.literal("reject"), saleId: z.string(), reason: z.string().trim().min(3, "دلیل رد الزامی است.").max(300) }),
  z.object({ action: z.literal("return"), saleId: z.string(), reason: z.string().trim().min(3, "دلیل مرجوعی الزامی است.").max(300) }),
  z.object({
    action: z.literal("register_payment"),
    saleId: z.string(),
    amount: z.number({ message: "مبلغ پرداخت را وارد کنید." }).int("مبلغ نامعتبر است.").min(1000, "مبلغ نامعتبر است."),
    paymentTrackingCode: z.string().trim().max(60).optional().or(z.literal("")),
    note: z.string().trim().max(300).optional().or(z.literal("")),
  }),
])

export async function POST(req: NextRequest) {
  const auth = await requirePermission("sales.review")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, actionSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  try {
    if (data.action === "transition") {
      const result = await db.$transaction(async (tx) => {
        const sale = await tx.saleCustomer.findUnique({ where: { id: data.saleId }, include: { plan: true, agent: true } })
        if (!sale) throw new Error("NOT_FOUND")
        const allowed = SALE_TRANSITIONS[sale.status] ?? []
        if (!allowed.includes(data.to)) throw new Error("INVALID_TRANSITION")

        const now = new Date()
        const patch: Record<string, unknown> = { status: data.to }

        if (data.to === "APPROVED") { patch.decidedById = auth.user.id; patch.decidedAt = now }
        if (data.to === "CARD_ISSUED") {
          patch.cardNumber = data.cardNumber || null
          patch.issuedAt = now
          if (!data.cardNumber) throw new Error("CARD_NUMBER_REQUIRED")
        }
        if (data.to === "SENT") patch.sentAt = now
        if (data.to === "DELIVERED") patch.deliveredAt = now

        let membershipId: string | null = null
        if (data.to === "FINALIZED") {
          // فروش نهایی = دقیقاً یک عضویت + یک پورسانت فروش (SALE-010 · REF-009 · OPEN-03)
          const existing = await tx.membership.findUnique({ where: { saleId: sale.id } })
          if (existing) throw new Error("ALREADY_FINALIZED")
          const membership = await tx.membership.create({
            data: {
              planId: sale.planId,
              holderId: sale.holderId,
              originType: "AGENT_SALE",
              saleId: sale.id,
              startDate: now,
              endDate: new Date(now.getTime() + sale.plan.durationDays * 86400000),
              status: "ACTIVE",
              usageLimit: sale.plan.usageLimit,
            },
          })
          membershipId = membership.id
          patch.finalizedAt = now

          const existingCommission = await tx.commission.findUnique({ where: { sourceSaleId: sale.id } })
          if (!existingCommission && sale.plan.salesCommissionPercent > 0) {
            const base = sale.paymentAmount ?? sale.plan.price
            await tx.commission.create({
              data: {
                beneficiaryUserId: sale.agent.userId,
                type: "SALE",
                planId: sale.planId,
                baseAmount: base,
                percent: sale.plan.salesCommissionPercent,
                amount: commissionAmount(base, sale.plan.salesCommissionPercent),
                status: "PENDING",
                sourceSaleId: sale.id,
                description: `پورسانت فروش ${sale.plan.title}`,
              },
            })
          }
        }

        await tx.saleCustomer.update({ where: { id: sale.id }, data: patch })
        return { sale, membershipId }
      })

      await audit(auth.user, `SALE_${data.to}`, "SALE_CUSTOMER", data.saleId, { reason: data.reason || null })
      const notifyMessages: Record<string, string> = {
        APPROVED: "پرونده فروش شما تأیید شد.",
        CARD_ISSUED: "کارت حامی‌کارت مشتری شما صادر شد.",
        SENT: "کارت مشتری ارسال شد.",
        DELIVERED: "کارت مشتری تحویل شد.",
        FINALIZED: "فروش نهایی شد و پورسانت آن در انتظار تأیید ثبت شد.",
      }
      await notify(result.sale.agentId ? (await db.agent.findUnique({ where: { id: result.sale.agentId } }))!.userId : "", "به‌روزرسانی پرونده فروش", notifyMessages[data.to], "INFO", "/agent/customers")
      return ok({ updated: true, membershipId: result.membershipId })
    }

    if (data.action === "reject") {
      const sale = await db.saleCustomer.findUnique({ where: { id: data.saleId } })
      if (!sale) return fail("پرونده یافت نشد.", 404)
      if (sale.status !== "PENDING_REVIEW") return fail("فقط پرونده در انتظار بررسی قابل رد است.", 409)
      await db.saleCustomer.update({
        where: { id: sale.id },
        data: { status: "REJECTED", rejectReason: data.reason, decidedById: auth.user.id, decidedAt: new Date() },
      })
      const agent = await db.agent.findUnique({ where: { id: sale.agentId } })
      if (agent) await notify(agent.userId, "رد پرونده فروش", `پرونده فروش رد شد. دلیل: ${data.reason}`, "WARNING", "/agent/customers")
      await audit(auth.user, "SALE_REJECTED", "SALE_CUSTOMER", sale.id, { reason: data.reason })
      return ok({ updated: true })
    }

    if (data.action === "register_payment") {
      // ثبت پرداخت فروش دستی (SALE-008 · OPEN-04: مجاز برای مدیر)
      const sale = await db.saleCustomer.findUnique({ where: { id: data.saleId } })
      if (!sale) return fail("پرونده یافت نشد.", 404)
      if (sale.status !== "DELIVERED") return fail("ثبت پرداخت فقط پس از تحویل کارت ممکن است.", 409)
      await db.saleCustomer.update({
        where: { id: sale.id },
        data: {
          status: "PAYMENT_REGISTERED",
          paymentAmount: data.amount,
          paymentDate: new Date(),
          paymentTrackingCode: data.paymentTrackingCode || null,
          paymentNote: data.note || null,
          paymentRegisteredById: auth.user.id,
        },
      })
      await audit(auth.user, "SALE_PAYMENT_REGISTERED", "SALE_CUSTOMER", sale.id, { amount: data.amount })
      return ok({ updated: true })
    }

    // return (AC-10 · OPEN-07)
    const result = await db.$transaction(async (tx) => {
      const sale = await tx.saleCustomer.findUnique({ where: { id: data.saleId }, include: { commission: true, membership: true } })
      if (!sale) throw new Error("NOT_FOUND")
      if (sale.status !== "FINALIZED") throw new Error("NOT_RETURNABLE")

      // اثر پورسانت: اگر تسویه نشده → لغو؛ اگر پرداخت‌شده → نیاز به اصلاح دستی مدیر ارشد
      if (sale.commission) {
        if (sale.commission.status === "PAID") throw new Error("COMMISSION_ALREADY_PAID")
        if (sale.commission.status !== "CANCELLED") {
          await tx.commission.update({ where: { id: sale.commission.id }, data: { status: "CANCELLED", rejectReason: `مرجوعی فروش: ${data.reason}` } })
        }
      }
      // اثر عضویت: لغو (BR-07)
      if (sale.membership && sale.membership.status === "ACTIVE") {
        await tx.membership.update({ where: { id: sale.membership.id }, data: { status: "CANCELLED", cancelReason: `مرجوعی فروش: ${data.reason}` } })
      }
      await tx.saleCustomer.update({
        where: { id: sale.id },
        data: { status: "RETURNED", returnedAt: new Date(), returnReason: data.reason, returnedById: auth.user.id },
      })
      return sale
    })

    const agent = await db.agent.findUnique({ where: { id: result.agentId } })
    if (agent) await notify(agent.userId, "مرجوعی فروش", `پرونده فروش مرجوع شد؛ عضویت و پورسانت مربوط لغو گردید. دلیل: ${data.reason}`, "WARNING", "/agent/customers")
    await audit(auth.user, "SALE_RETURNED", "SALE_CUSTOMER", data.saleId, { reason: data.reason })
    return ok({ updated: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const map: Record<string, string> = {
      NOT_FOUND: "پرونده یافت نشد.",
      INVALID_TRANSITION: "این تغییر وضعیت برای وضعیت فعلی مجاز نیست.",
      CARD_NUMBER_REQUIRED: "برای صدور کارت، شماره کارت الزامی است.",
      ALREADY_FINALIZED: "این فروش قبلاً نهایی شده است.",
      NOT_RETURNABLE: "فقط فروش نهایی‌شده قابل مرجوع است.",
      COMMISSION_ALREADY_PAID: "پورسانت این فروش قبلاً تسویه شده است؛ مرجوعی نیازمند اصلاح دستی مدیر ارشد است.",
    }
    if (msg in map) return fail(map[msg], 409)
    console.error("[SALE_ACTION_FAIL]", e)
    return fail("خطا در انجام عملیات.", 500)
  }
}
