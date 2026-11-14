import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { applyWalletTx } from "@/lib/wallet"
import { genTrackingCode } from "@/lib/codes"
import { getSetting } from "@/lib/settings"
import { notify } from "@/lib/audit"
import { amountSchema, isValidSheba, isValidCardNumber, toEnDigits } from "@/lib/validators"

// درخواست تسویه (SETTLE-001..017 · AC-12 · BR-21/22) — فقط ثبت و پیگیری؛ پرداخت خارج از سامانه
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const [settlements, minAmount] = await Promise.all([
    db.settlementRequest.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
    }),
    // حداقل مبلغ مجاز از تنظیمات (ADMIN-023) تا داشبورد نماینده همیشه مقدار به‌روز را ببیند
    getSetting("MIN_SETTLEMENT_AMOUNT").then((v) => parseInt(v, 10) || 100000),
  ])

  return ok({
    settlements: settlements.map((s) => ({
      id: s.id,
      amount: s.amount,
      status: s.status,
      trackingCode: s.trackingCode,
      reviewNote: s.reviewNote,
      paymentTrackingCode: s.paymentTrackingCode,
      cancelReason: s.cancelReason,
      createdAt: s.createdAt,
      reviewedAt: s.reviewedAt,
      paidAt: s.paidAt,
    })),
    minAmount,
  })
}

const createSchema = z.object({
  amount: amountSchema,
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, createSchema)
  if ("response" in parsed) return parsed.response
  const { amount } = parsed.data

  try {
    const minAmount = parseInt(await getSetting("MIN_SETTLEMENT_AMOUNT"), 10) || 100000

    const result = await db.$transaction(async (tx) => {
      const profile = await tx.userProfile.findUnique({ where: { userId: auth.user.id } })

      // الزام اطلاعات بانکی معتبر فقط برای تسویه (PROFILE-007 · SETTLE-002/003 · AC-04)
      if (
        !profile ||
        !profile.cardNumber ||
        !profile.sheba ||
        !profile.bankAccountName ||
        !isValidCardNumber(profile.cardNumber) ||
        !isValidSheba(profile.sheba)
      ) {
        throw new Error("BANK_INFO_INCOMPLETE")
      }

      const wallet = await tx.wallet.findUnique({ where: { userId: auth.user.id } })
      const withdrawable = wallet?.withdrawableBalance ?? 0

      if (amount < minAmount) throw new Error("BELOW_MIN")
      if (amount > withdrawable) throw new Error("INSUFFICIENT_BALANCE")

      // فقط یک درخواست باز در هر لحظه (SETTLE-005/011 · AC-12)
      // لایه ۱: بررسی سریع در سطح اپلیکیشن؛ لایه ۲: ایندکس یکتای جزئی دیتابیس
      const openCount = await tx.settlementRequest.count({
        where: { userId: auth.user.id, status: { in: ["PENDING", "APPROVED"] } },
      })
      if (openCount > 0) throw new Error("OPEN_REQUEST_EXISTS")

      // ابتدا رکورد درخواست ساخته می‌شود تا کلید توانمندی پایدار برای نگهداشت داشته باشیم
      const settlement = await tx.settlementRequest.create({
        data: {
          userId: auth.user.id,
          amount,
          bankCardNumber: profile.cardNumber,
          bankSheba: profile.sheba,
          bankAccountName: profile.bankAccountName,
          trackingCode: genTrackingCode("ST"),
          status: "PENDING",
        },
      })

      // نگهداشت مبلغ در همان تراکنش (SEC-007/008 · WALLET-006 idempotent)
      await applyWalletTx(tx, auth.user.id, "HOLD", amount, {
        refType: "SETTLEMENT",
        refId: settlement.id,
        note: "نگهداشت بابت درخواست تسویه",
        createdBy: auth.user.id,
        idempotencyKey: `settlement:${settlement.id}:hold`,
      })

      return { settlement, minAmount }
    })

    await notify(
      auth.user.id,
      "درخواست تسویه ثبت شد",
      `درخواست تسویه شما با کد پیگیری ${result.settlement.trackingCode} ثبت شد و پس از بررسی مدیر تعیین تکلیف می‌شود. پرداخت خارج از سامانه انجام می‌شود.`,
      "INFO",
      "/agent/settlements"
    )

    return ok({
      settlementId: result.settlement.id,
      trackingCode: result.settlement.trackingCode,
      minAmount: result.minAmount,
      message: "درخواست ثبت شد. مبلغ تا تعیین تکلیف در کیف پول نگه‌داشته می‌شود؛ انتقال وجه خارج از سامانه و توسط مسئول مجاز ثبت می‌شود.",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    const map: Record<string, string> = {
      BANK_INFO_INCOMPLETE: "برای درخواست تسویه، شماره کارت، شبا و نام صاحب حساب معتبر در پروفایل الزامی است.",
      BELOW_MIN: "مبلغ درخواست کمتر از حداقل مجاز است.",
      INSUFFICIENT_BALANCE: "مبلغ درخواست بیشتر از مانده قابل برداشت است.",
      OPEN_REQUEST_EXISTS: "شما یک درخواست باز تسویه دارید؛ ابتدا وضعیت آن تعیین تکلیف شود.",
    }
    if (msg in map) return fail(map[msg], 409)
    // قید دیتابیس (ایندکس یکتای جزئی SETTLE-005) در شرایط مسابقه فعال می‌شود
    if (msg.includes("idx_settlement_one_open_per_user") || msg.includes("Unique constraint")) {
      return fail(map.OPEN_REQUEST_EXISTS, 409)
    }
    console.error("[SETTLEMENT_CREATE_FAIL]", e)
    return fail("خطا در ثبت درخواست تسویه.", 500)
  }
}

// لغو درخواست در وضعیت «در انتظار» (SETTLE-006)
export async function DELETE(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const id = (body as { id?: string }).id
  if (!id) return fail("شناسه درخواست الزامی است.", 422)

  try {
    await db.$transaction(async (tx) => {
      const s = await tx.settlementRequest.findFirst({ where: { id, userId: auth.user.id } })
      if (!s) throw new Error("NOT_FOUND")
      if (s.status !== "PENDING") throw new Error("NOT_CANCELLABLE")

      await applyWalletTx(tx, auth.user.id, "RELEASE", s.amount, {
        refType: "SETTLEMENT",
        refId: s.id,
        note: "آزادسازی بابت لغو درخواست تسویه",
        createdBy: auth.user.id,
        idempotencyKey: `settlement:${s.id}:release`,
      })
      await tx.settlementRequest.update({
        where: { id: s.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "لغو توسط متقاضی" },
      })
    })
    return ok({ cancelled: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "NOT_FOUND") return fail("درخواست یافت نشد.", 404)
    if (msg === "NOT_CANCELLABLE") return fail("فقط درخواست در وضعیت «در انتظار» قابل لغو است.", 409)
    console.error("[SETTLEMENT_CANCEL_FAIL]", e)
    return fail("خطا در لغو درخواست.", 500)
  }
}
