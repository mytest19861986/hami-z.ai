// منطق کیف پول — دفتر تراکنش‌ها با دلتاهای صریح (WALLET-001..010 · BR-14..16)
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

async function getOrCreateWallet(tx: Tx, userId: string) {
  let wallet = await tx.wallet.findUnique({ where: { userId } })
  if (!wallet) {
    wallet = await tx.wallet.create({ data: { userId } })
  }
  return wallet
}

/**
 * ثبت تراکنش کیف پول به‌صورت اتمیک؛ مانده‌ها همیشه از دل همین تراکنش‌ها به‌روز می‌شوند.
 * types:
 *  - COMMISSION_CREDIT: +withdrawable (تأیید پورسانت)
 *  - HOLD: withdrawable→held (ثبت درخواست تسویه)
 *  - RELEASE: held→withdrawable (رد/لغو تسویه)
 *  - SETTLE_PAID: -held (ثبت پرداخت خارج از سامانه)
 *  - ADMIN_ADJUST: اصلاح دستی مدیر ارشد
 */
export async function applyWalletTx(
  tx: Tx,
  userId: string,
  type: "COMMISSION_CREDIT" | "HOLD" | "RELEASE" | "SETTLE_PAID" | "ADMIN_ADJUST",
  amount: number,
  opts: { refType?: string; refId?: string; note?: string; createdBy?: string; force?: boolean } = {}
): Promise<{ walletId: string; withdrawableAfter: number }> {
  const wallet = await getOrCreateWallet(tx, userId)
  let wd = wallet.withdrawableBalance
  let held = wallet.heldBalance

  switch (type) {
    case "COMMISSION_CREDIT":
      wd += amount
      break
    case "HOLD":
      if (!opts.force && wd < amount) throw new Error("مانده قابل برداشت کافی نیست.")
      wd -= amount
      held += amount
      break
    case "RELEASE":
      if (!opts.force && held < amount) throw new Error("مانده نگه‌داشته‌شده کافی نیست.")
      held -= amount
      wd += amount
      break
    case "SETTLE_PAID":
      if (!opts.force && held < amount) throw new Error("مانده نگه‌داشته‌شده کافی نیست.")
      held -= amount
      break
    case "ADMIN_ADJUST":
      // amount مثبت = افزایش، منفی = کاهش
      wd += amount
      if (wd < 0) throw new Error("مانده قابل برداشت منفی نمی‌شود.")
      break
  }

  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { withdrawableBalance: wd, heldBalance: held },
  })

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type,
      amount: Math.abs(amount),
      withdrawableDelta: type === "HOLD" ? -amount : type === "RELEASE" ? amount : type === "COMMISSION_CREDIT" ? amount : type === "ADMIN_ADJUST" ? amount : 0,
      heldDelta: type === "HOLD" ? amount : type === "RELEASE" ? -amount : type === "SETTLE_PAID" ? -amount : 0,
      balanceAfter: wd,
      refType: opts.refType,
      refId: opts.refId,
      note: opts.note,
      createdBy: opts.createdBy,
    },
  })

  return { walletId: wallet.id, withdrawableAfter: updated.withdrawableBalance }
}

/** جمع پورسانت‌های در انتظار تأیید برای نمایش «در انتظار» (WALLET-003) */
export async function pendingCommissionsTotal(userId: string): Promise<number> {
  const agg = await db.commission.aggregate({
    where: { beneficiaryUserId: userId, status: "PENDING" },
    _sum: { amount: true },
  })
  return agg._sum.amount ?? 0
}
