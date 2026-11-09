import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { genTrackingCode } from "@/lib/codes"
import { notify } from "@/lib/audit"
import { mobileSchema } from "@/lib/validators"

// خرید طرح (PAY-001..010 · AC-05 · AC-06) — بدون درگاه واقعی، تأیید دستی و صادقانه
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const purchases = await db.purchase.findMany({
    where: { buyerUserId: auth.user.id },
    include: {
      plan: { select: { title: true, discountPercent: true, durationDays: true } },
      holder: { select: { firstName: true, lastName: true, nationalCode: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return ok(
    purchases.map((p) => ({
      id: p.id,
      trackingCode: p.trackingCode,
      planTitle: p.plan.title,
      holder: `${p.holder.firstName} ${p.holder.lastName}`,
      amount: p.amount,
      status: p.status,
      referrerMobile: p.referrerMobile,
      createdAt: p.createdAt,
      approvedAt: p.approvedAt,
      rejectReason: p.rejectReason,
    }))
  )
}

const createPurchaseSchema = z.object({
  planId: z.string().min(1, "طرح را انتخاب کنید."),
  holderId: z.string().min(1, "دارنده طرح را انتخاب کنید."),
  referrerMobile: mobileSchema.optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, createPurchaseSchema)
  if ("response" in parsed) return parsed.response
  const { planId, holderId, referrerMobile } = parsed.data

  // طرح باید فعال باشد (PLAN-005)
  const plan = await db.discountPlan.findFirst({ where: { id: planId, isActive: true } })
  if (!plan) return fail("طرح انتخاب‌شده فعال نیست یا وجود ندارد.", 404)

  // مالکیت دارنده (RBAC-006 · SEC-009)
  const holder = await db.planHolder.findFirst({
    where: { id: holderId, createdByUserId: auth.user.id },
  })
  if (!holder) return fail("دارنده طرح نامعتبر است.", 403)

  // اعتبار معرف (REF-001/002) — فقط نقش همکار معرفی پورسانت معرفی می‌گیرد
  let referrerValid = false
  if (referrerMobile) {
    const referrer = await db.user.findFirst({
      where: { mobile: referrerMobile, status: "ACTIVE", roles: { some: { role: { name: "REFERRER" } } } },
    })
    referrerValid = !!referrer
    if (!referrerValid) {
      return fail("شماره معرف معتبر نیست یا دارای نقش همکار معرفی نیست.", 422)
    }
    if (referrer!.id === auth.user.id) return fail("نمی‌توانید خودتان را معرف ثبت کنید.", 422)
  }

  // جلوگیری از درخواست تکراری باز برای همان طرح/دارنده (AC-06)
  const existingPending = await db.purchase.findFirst({
    where: { buyerUserId: auth.user.id, planId, holderId, status: "PENDING" },
  })
  if (existingPending) {
    return ok({
      purchase: { id: existingPending.id, trackingCode: existingPending.trackingCode },
      reused: true,
      message: "درخواست باز با همین طرح و دارنده دارید؛ نتیجه پس از بررسی مدیر اعلام می‌شود.",
    })
  }

  const purchase = await db.purchase.create({
    data: {
      planId,
      buyerUserId: auth.user.id,
      holderId,
      referrerMobile: referrerMobile || null,
      amount: plan.price,
      status: "PENDING",
      trackingCode: genTrackingCode("HK"),
    },
  })

  await notify(
    auth.user.id,
    "درخواست خرید ثبت شد",
    `درخواست خرید «${plan.title}» با کد پیگیری ${purchase.trackingCode} ثبت شد. درگاه پرداخت هنوز متصل نیست؛ پرداخت و فعال‌سازی پس از بررسی و تأیید مدیر انجام می‌شود.`,
    "INFO",
    "/user/purchases"
  )

  return ok({
    purchase: { id: purchase.id, trackingCode: purchase.trackingCode, amount: purchase.amount },
    reused: false,
    paymentGatewayConnected: false,
    message:
      "درگاه پرداخت واقعی هنوز متصل نشده است. پرداخت طبق هماهنگی خارج از سامانه و تأیید دستی مدیر انجام می‌شود؛ تا آن زمان طرح فعال نمی‌شود.",
  })
}
