import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { genTrackingCode } from "@/lib/codes"
import { audit, notify } from "@/lib/audit"
import { mobileSchema } from "@/lib/validators"

// اطلاع‌رسانی درخواست خرید جدید به مدیران (PAY · ADMIN) —
// زنگ اعلان‌های پنل ادمین و «رخدادهای سیستم» بلافاصله پس از ثبت درخواست به‌روز می‌شود.
async function notifyAdminsOfNewPurchase(input: {
  planTitle: string
  trackingCode: string
  buyerMobile: string
  amount: number
}) {
  const admins = await db.user.findMany({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { name: { in: ["ADMIN", "SUPER_ADMIN"] } } } },
    },
    select: { id: true },
  })
  await Promise.all(
    admins.map((a) =>
      notify(
        a.id,
        "درخواست خرید جدید در انتظار تأیید",
        `طرح «${input.planTitle}» با کد پیگیری ${input.trackingCode} برای خریدار ${input.buyerMobile} ثبت شد. درگاه پرداخت متصل نیست؛ پس از هماهنگی پرداخت، درخواست را تأیید یا رد کنید.`,
        "WARNING",
        "/admin/purchases?status=PENDING"
      )
    )
  )
}
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

// PAY/SELF: دارنده طرح ارسال نمی‌شود — خرید فقط به نام خودِ کاربر ثبت می‌شود
const createPurchaseSchema = z.object({
  planId: z.string().min(1, "طرح را انتخاب کنید."),
  referrerMobile: mobileSchema.optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, createPurchaseSchema)
  if ("response" in parsed) return parsed.response
  const { planId, referrerMobile } = parsed.data

  // طرح باید فعال باشد (PLAN-005)
  const plan = await db.discountPlan.findFirst({ where: { id: planId, isActive: true } })
  if (!plan) return fail("طرح انتخاب‌شده فعال نیست یا وجود ندارد.", 404)

  // REF-SYS/PAY/SELF: نام، نام خانوادگی و کد ملی خریدار برای ثبت طرح به نام خودش الزامی است
  const buyerProfile = await db.userProfile.findUnique({ where: { userId: auth.user.id } })
  const nameOk =
    !!buyerProfile?.firstName && buyerProfile.firstName.trim().length >= 2 &&
    !!buyerProfile?.lastName && buyerProfile.lastName.trim().length >= 2
  if (!buyerProfile?.nationalCode || !/^\d{10}$/.test(buyerProfile.nationalCode) || !nameOk) {
    return fail(
      "برای خرید طرح به نام خودتان، تکمیل نام، نام خانوادگی و کد ملی (۱۰ رقم) در پروفایل الزامی است.",
      422,
      { needProfile: true }
    )
  }

  // PAY/SELF: دارندهٔ طرح = خودِ خریدار؛ بر پایهٔ کد ملی یکتا پیدا یا ساخته می‌شود
  // (اگر قبلاً مثلاً از طریق فروش نماینده کارتی با همین کد ملی ثبت شده باشد، همان هویت استفاده می‌شود)
  let holder = await db.planHolder.findUnique({
    where: { nationalCode: buyerProfile.nationalCode },
  })
  if (!holder) {
    try {
      holder = await db.planHolder.create({
        data: {
          firstName: buyerProfile.firstName.trim(),
          lastName: buyerProfile.lastName.trim(),
          nationalCode: buyerProfile.nationalCode,
          mobile: auth.user.mobile,
          createdByUserId: auth.user.id,
        },
      })
    } catch {
      // رقابت هم‌زمان روی یکتایی کد ملی — دوباره پیدا کن
      holder = await db.planHolder.findUnique({
        where: { nationalCode: buyerProfile.nationalCode },
      })
      if (!holder) return fail("خطا در ثبت دارنده طرح.", 500)
    }
  }

  // REF-SYS: فیلد قدیمی معرف (شماره موبایل) فقط اعتبار قالب می‌گیرد؛ تعیین پورسانت در تأیید خرید
  // بر اساس اتصال ثبت‌نام (کد رفرال) انجام می‌شود و این فیلد صرفاً تکمیلی/قدیمی است.
  if (referrerMobile) {
    if (referrerMobile === auth.user.mobile) return fail("نمی‌توانید خودتان را معرف ثبت کنید.", 422)
  }

  // جلوگیری از درخواست تکراری باز برای همان طرح/دارنده (AC-06)
  const existingPending = await db.purchase.findFirst({
    where: { buyerUserId: auth.user.id, planId, holderId: holder.id, status: "PENDING" },
  })
  if (existingPending) {
    return ok({
      purchase: { id: existingPending.id, trackingCode: existingPending.trackingCode },
      reused: true,
      message: "درخواست باز با همین طرح دارید؛ نتیجه پس از بررسی مدیر اعلام می‌شود.",
    })
  }

  const purchase = await db.purchase.create({
    data: {
      planId,
      buyerUserId: auth.user.id,
      holderId: holder.id,
      referrerMobile: referrerMobile || null,
      amount: plan.price,
      status: "PENDING",
      trackingCode: genTrackingCode("HK"),
    },
  })

  // ثبت رخداد + اطلاع به مدیران برای تأیید (ADMIN-013)
  await audit(auth.user, "PURCHASE_CREATE", "PURCHASE", purchase.id, {
    trackingCode: purchase.trackingCode,
    planTitle: plan.title,
    amount: purchase.amount,
  })
  await notifyAdminsOfNewPurchase({
    planTitle: plan.title,
    trackingCode: purchase.trackingCode,
    buyerMobile: auth.user.mobile,
    amount: purchase.amount,
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
      "درگاه پرداخت آنلاین متصل نیست؛ درخواست شما با موفقیت ثبت شد و پس از پرداخت طبق هماهنگی و تأیید مدیر، طرح فعال خواهد شد.",
  })
}
