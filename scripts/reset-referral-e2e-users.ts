// ریست کاربران آزمایشی E2E رفرال (A/B) به حالت اولیه برای اجرای idempotent
// ترتیب حذف با توجه به زنجیرهٔ FK در SQLite:
//   Commission → SettlementRequest / Purchase / SaleCustomer
//   Visit → Membership / PlanHolder ، Membership → PlanHolder / Purchase ، Purchase → PlanHolder
// بنابراین: Commission → Settlement → WalletTx/Wallet → Visit → Membership → Purchase (PlanHolder می‌ماند)
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const MOBILES = ["09351110001", "09351110002"]

async function main() {
  for (const mobile of MOBILES) {
    const user = await db.user.findFirst({ where: { mobile } })
    if (!user) {
      console.log(`${mobile}: ندارد (رد شد)`)
      continue
    }
    // ۱) پورسانت‌ها (هم به‌عنوان ذی‌نفع، هم ناشی از خریدهای این کاربر)
    try { await db.commission.deleteMany({ where: { beneficiaryUserId: user.id } }) } catch (e) { console.log("FAIL commission-beneficiary:", e.code) }
    try { await db.commission.deleteMany({ where: { sourcePurchase: { buyerUserId: user.id } } }) } catch (e) { console.log("FAIL commission-source:", e.code) }
    // ۲) تسویه‌ها
    try { await db.settlementRequest.deleteMany({ where: { userId: user.id } }) } catch (e) { console.log("FAIL settlement:", e.code) }
    // ۳) کیف پول: دفتر مالی append-only است (تریگر WALLET_LEDGER_APPEND_ONLY)
    //    → تراکنش‌ها حذف نمی‌شوند؛ فقط مانده صفر می‌شود تا اجرای idempotent ممکن باشد.
    await db.wallet.updateMany({ where: { userId: user.id }, data: { withdrawableBalance: 0, heldBalance: 0 } })
    // ۴) ویزیت‌ها، عضویت‌ها و خریدهای آزمایشی
    const purchases = await db.purchase.findMany({ where: { buyerUserId: user.id }, select: { id: true } })
    const purchaseIds = purchases.map((p) => p.id)
    const memberships = await db.membership.findMany({
      where: { OR: [{ purchaseId: { in: purchaseIds } }, { buyerUserId: user.id }] },
      select: { id: true },
    })
    const membershipIds = memberships.map((m) => m.id)
    if (membershipIds.length > 0) {
      try { await db.visit.deleteMany({ where: { membershipId: { in: membershipIds } } }) } catch (e) { console.log("FAIL visit:", e.code) }
    }
    try { await db.membership.deleteMany({ where: { id: { in: membershipIds } } }) } catch (e) { console.log("FAIL membership:", e.code) }
    try { await db.purchase.deleteMany({ where: { id: { in: purchaseIds } } }) } catch (e) { console.log("FAIL purchase:", e.code) }
    // ۵) پروفایل به حالت کاربر تازه‌وارد (بدون کد ملی و بانکی)
    await db.userProfile.updateMany({
      where: { userId: user.id },
      data: { cardNumber: null, sheba: null, bankAccountName: null, nationalCode: null },
    })
    console.log(`${mobile}: ریست شد (پورسانت/تسویه/کیف پول/خرید/عضویت حذف شد)`)
  }
  await db.$disconnect()
}

main()
