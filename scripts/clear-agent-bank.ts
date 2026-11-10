// پاک‌سازی موقت اطلاعات بانکی ایجنت برای تست حالت ناقص در صفحهٔ تسویه
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const p = await db.userProfile.findFirst({ where: { user: { mobile: "09120000002" } } })
  if (!p) throw new Error("profile not found")
  await db.userProfile.update({ where: { id: p.id }, data: { cardNumber: null, sheba: null, bankAccountName: null } })
  console.log("CLEARED")
  await db.$disconnect()
}

main()
