// بررسی ثبت اطلاعات بانکی در دیتابیس
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const users = ["09120000002", "09120000001"]
  for (const mobile of users) {
    const p = await db.userProfile.findFirst({ where: { user: { mobile } } })
    console.log(
      mobile,
      "→",
      JSON.stringify({ card: p?.cardNumber ?? null, sheba: p?.sheba ?? null, name: p?.bankAccountName ?? null })
    )
  }
  await db.$disconnect()
}

main()
