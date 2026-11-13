import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { isValidNationalCode, mobileSchema, nationalCodeSchema, toEnDigits } from "@/lib/validators"

// ثبت مشتری فروش (SALE-001..003 · AGENT-DASH-003) — ثبت مشتری ≠ فروش قطعی (BR-11)
// فیلتر بازه: from/to میلادی ISO (YYYY-MM-DD) با مرزهای روز +03:30 (هم‌قالب بقیهٔ فیلترهای بازه)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const agent = await db.agent.findUnique({ where: { userId: auth.user.id } })
  if (!agent) return fail("پروفایل نمایندگی یافت نشد.", 404)

  const sp = req.nextUrl.searchParams
  const q = (sp.get("q") ?? "").trim()
  const status = sp.get("status") ?? ""
  const fromStr = (sp.get("from") ?? "").trim()
  const toStr = (sp.get("to") ?? "").trim()
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 15

  // اعتبارسنجی بازه (در صورت وجود): قالب ISO + از ≤ تا
  let from: Date | null = null
  let to: Date | null = null
  if (fromStr || toStr) {
    if (!DATE_RE.test(fromStr) || !DATE_RE.test(toStr)) {
      return fail("بازه تاریخ نامعتبر است. هر دو تاریخ «از» و «تا» لازم است (YYYY-MM-DD).", 422)
    }
    from = new Date(`${fromStr}T00:00:00+03:30`)
    to = new Date(`${toStr}T23:59:59.999+03:30`)
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return fail("بازه تاریخ نامعتبر است: «از» باید قبل از «تا» باشد.", 422)
    }
  }

  const where = {
    agentId: agent.id,
    ...(status ? { status } : {}),
    ...(from && to ? { createdAt: { gte: from, lte: to } } : {}),
    ...(q
      ? {
          OR: [
            { holder: { firstName: { contains: q } } },
            { holder: { lastName: { contains: q } } },
            { holder: { mobile: { contains: toEnDigits(q) } } },
            { holder: { nationalCode: { contains: toEnDigits(q) } } },
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
        holder: { select: { firstName: true, lastName: true, nationalCode: true, mobile: true } },
        plan: { select: { title: true, price: true } },
      },
    }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    customers: sales.map((s) => ({
      id: s.id,
      holder: `${s.holder.firstName} ${s.holder.lastName}`,
      nationalCode: s.holder.nationalCode,
      mobile: s.holder.mobile,
      planTitle: s.plan.title,
      planPrice: s.plan.price,
      status: s.status,
      address: s.address,
      postalCode: s.postalCode,
      cardNumber: s.cardNumber,
      rejectReason: s.rejectReason,
      returnReason: s.returnReason,
      paymentAmount: s.paymentAmount,
      paymentTrackingCode: s.paymentTrackingCode,
      createdAt: s.createdAt,
      deliveredAt: s.deliveredAt,
      finalizedAt: s.finalizedAt,
    })),
  })
}

const createSchema = z.object({
  firstName: z.string().trim().min(2, "نام مشتری الزامی است.").max(50),
  lastName: z.string().trim().min(2, "نام خانوادگی الزامی است.").max(50),
  nationalCode: nationalCodeSchema,
  mobile: mobileSchema.optional().or(z.literal("")),
  planId: z.string().min(1, "طرح را انتخاب کنید."),
  address: z.string().trim().min(5, "نشانی ارسال الزامی است.").max(400),
  postalCode: z.string().trim().max(10).optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const agent = await db.agent.findUnique({ where: { userId: auth.user.id } })
  if (!agent || agent.status !== "APPROVED") {
    return fail("ثبت مشتری فقط برای نماینده تأییدشده فعال است.", 403)
  }

  const parsed = await parseBody(req, createSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  const plan = await db.discountPlan.findFirst({ where: { id: data.planId, isActive: true } })
  if (!plan) return fail("طرح انتخاب‌شده فعال نیست.", 404)

  const nationalCode = toEnDigits(data.nationalCode).trim()
  if (!isValidNationalCode(nationalCode)) return fail("کد ملی مشتری معتبر نیست.", 422)

  // دارنده: موجود (هر کاربر) یا جدید — ثبت تکراری پرونده باز همان طرح جلوگیری می‌شود
  const holder = await db.planHolder.upsert({
    where: { nationalCode },
    update: {},
    create: {
      firstName: data.firstName,
      lastName: data.lastName,
      nationalCode,
      mobile: data.mobile || null,
      createdByUserId: auth.user.id,
    },
  })

  const openDup = await db.saleCustomer.findFirst({
    where: {
      holderId: holder.id,
      planId: plan.id,
      status: { in: ["PENDING_REVIEW", "APPROVED", "CARD_ISSUED", "SENT", "DELIVERED", "PAYMENT_REGISTERED"] },
    },
  })
  if (openDup) {
    return fail("برای این مشتری و طرح، پرونده بازی در جریان است.", 409)
  }

  const sale = await db.saleCustomer.create({
    data: {
      agentId: agent.id,
      holderId: holder.id,
      planId: plan.id,
      address: data.address,
      postalCode: data.postalCode ? toEnDigits(data.postalCode) : null,
      status: "PENDING_REVIEW",
    },
  })

  return ok({
    saleId: sale.id,
    status: sale.status,
    message: "پرونده مشتری ثبت شد و در انتظار بررسی مدیر است. ثبت مشتری به‌تنهایی به معنی فروش قطعی نیست.",
  })
}
