// REF-SYS: backfill کد رفرال یکتا برای کاربران موجود
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function genCode() {
  let out = ""
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return out
}

async function main() {
  const noCode = await db.user.findMany({ where: { referralCode: null }, select: { id: true, mobile: true } })
  console.log(`کاربران بدون کد رفرال: ${noCode.length}`)
  let done = 0
  for (const u of noCode) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const c = genCode()
      const clash = await db.user.findUnique({ where: { referralCode: c }, select: { id: true } })
      if (!clash) {
        await db.user.update({ where: { id: u.id }, data: { referralCode: c } })
        done++
        break
      }
    }
  }
  console.log(`✅ ${done} کاربر کد رفرال گرفت`)
  const total = await db.user.count({ where: { referralCode: { not: null } } })
  console.log(`جمع کاربران دارای کد رفرال: ${total}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
