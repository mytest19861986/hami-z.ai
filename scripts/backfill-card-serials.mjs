// Backfill: تولید سریال کارت برای عضویت‌های موجود (SURF-USER · یک‌بار اجرا)
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

function genSerial() {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("")
  return `HK ${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`
}

async function main() {
  const missing = await db.membership.findMany({ where: { cardSerial: null }, select: { id: true } })
  console.log(`عضویت‌های بدون سریال: ${missing.length}`)
  let done = 0
  for (const m of missing) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await db.membership.update({ where: { id: m.id }, data: { cardSerial: genSerial() } })
        done++
        break
      } catch (e) {
        if (String(e.message).includes("Unique constraint") && attempt < 4) continue
        throw e
      }
    }
  }
  console.log(`✓ سریال برای ${done} عضویت تولید شد.`)
}

main().catch((e) => { console.error("✗", e); process.exit(1) }).finally(() => db.$disconnect())
