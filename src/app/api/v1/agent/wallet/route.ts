import { ok, requireUser } from "@/lib/api"
import { db } from "@/lib/db"
import { pendingCommissionsTotal } from "@/lib/wallet"

// خلاصه کیف پول و گردش مالی (WALLET-001..008 · AGENT-DASH-007)
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  let wallet = await db.wallet.findUnique({
    where: { userId: auth.user.id },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 100 } },
  })
  if (!wallet) {
    await db.wallet.create({ data: { userId: auth.user.id } })
    wallet = await db.wallet.findUnique({
      where: { userId: auth.user.id },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 100 } },
    })
  }

  const pending = await pendingCommissionsTotal(auth.user.id)

  return ok({
    withdrawableBalance: wallet!.withdrawableBalance,
    heldBalance: wallet!.heldBalance,
    pendingCommission: pending,
    transactions: wallet!.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      withdrawableDelta: t.withdrawableDelta,
      heldDelta: t.heldDelta,
      balanceAfter: t.balanceAfter,
      note: t.note,
      createdAt: t.createdAt,
    })),
  })
}
