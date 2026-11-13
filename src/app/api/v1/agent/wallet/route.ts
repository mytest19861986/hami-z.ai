import { NextRequest } from "next/server"
import { ok, fail, requireUser } from "@/lib/api"
import { db } from "@/lib/db"
import { pendingCommissionsTotal } from "@/lib/wallet"

// خلاصه کیف پول و گردش مالی (WALLET-001..008 · AGENT-DASH-007)
// فیلتر تراکنش‌ها: from/to (میلادی ISO با مرزهای روز +03:30) + type
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const fromStr = (sp.get("from") ?? "").trim()
  const toStr = (sp.get("to") ?? "").trim()
  const type = sp.get("type") ?? ""

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

  let wallet = await db.wallet.findUnique({
    where: { userId: auth.user.id },
    include: {
      transactions: {
        where: {
          ...(type ? { type } : {}),
          ...(from && to ? { createdAt: { gte: from, lte: to } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
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
    // فیلترهای اعمال‌شده برای نمایش در UI
    filtered: !!(from && to) || !!type,
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
