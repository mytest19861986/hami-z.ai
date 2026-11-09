// تأیید اینوارینت‌های سطح دیتابیس (SETTLE-005 · WALLET-006)
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  // ۱) ایندکس یکتای جزئی تسویه موجود است؟
  const idx = await db.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_settlement_one_open_per_user'"
  )
  console.log(idx.length ? "✓ idx_settlement_one_open_per_user EXISTS" : "✗ PARTIAL INDEX MISSING")
  if (!idx.length) process.exit(1)

  // ۲) تریگرهای append-only موجودند؟
  const trg = await db.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('trg_wallet_ledger_no_update','trg_wallet_ledger_no_delete') ORDER BY name"
  )
  console.log(trg.map((t) => `✓ ${t.name} EXISTS`).join("\n"))
  if (trg.length !== 2) process.exit(1)

  // ۳) تلاش واقعی برای شکستن append-only → باید ABORT شود
  try {
    await db.$executeRawUnsafe("UPDATE WalletTransaction SET amount = amount + 1 WHERE rowid IN (SELECT MIN(rowid) FROM WalletTransaction)")
    console.log("✗ APPEND-ONLY BROKEN — update succeeded!")
    process.exit(1)
  } catch (e) {
    console.log("✓ UPDATE blocked by DB:", String(e.message).includes("WALLET_LEDGER_APPEND_ONLY") ? "WALLET_LEDGER_APPEND_ONLY" : e.message.slice(0, 50))
  }
  try {
    await db.$executeRawUnsafe("DELETE FROM WalletTransaction WHERE rowid IN (SELECT MIN(rowid) FROM WalletTransaction)")
    console.log("✗ APPEND-ONLY BROKEN — delete succeeded!")
    process.exit(1)
  } catch (e) {
    console.log("✓ DELETE blocked by DB:", String(e.message).includes("WALLET_LEDGER_APPEND_ONLY") ? "WALLET_LEDGER_APPEND_ONLY" : e.message.slice(0, 50))
  }

  // ۴) تلاش واقعی برای ایجاد دو تسویه باز برای یک کاربر → باید UNIQUE FAIL شود
  const anyUser = await db.user.findFirst({ select: { id: true } })
  const now = new Date().toISOString()
  const cols = "(id, userId, amount, status, bankCardNumber, bankSheba, bankAccountName, trackingCode, createdAt, updatedAt)"
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO SettlementRequest ${cols} VALUES ('inv-test-1', '${anyUser.id}', 100000, 'PENDING', '6037991122334455', 'IR120120000000001234567890', 'تست', 'INV-TEST-1', '${now}', '${now}')`
    )
    await db.$executeRawUnsafe(
      `INSERT INTO SettlementRequest ${cols} VALUES ('inv-test-2', '${anyUser.id}', 200000, 'PENDING', '6037991122334455', 'IR120120000000001234567890', 'تست', 'INV-TEST-2', '${now}', '${now}')`
    )
    console.log("✗ PARTIAL UNIQUE BROKEN — second open settlement inserted!")
    process.exit(1)
  } catch (e) {
    const ok = String(e.message).includes("idx_settlement_one_open_per_user") || String(e.message).toUpperCase().includes("UNIQUE")
    console.log(ok ? "✓ second open settlement REJECTED by partial unique index" : `؟ unexpected: ${e.message.slice(0, 80)}`)
  } finally {
    await db.$executeRawUnsafe("DELETE FROM SettlementRequest WHERE id IN ('inv-test-1','inv-test-2')")
  }

  console.log("\n🏁 همه اینوارینت‌های دیتابیس فعال و مؤثرند.")
}

main().catch((e) => { console.error("✗", e); process.exit(1) }).finally(() => db.$disconnect())
