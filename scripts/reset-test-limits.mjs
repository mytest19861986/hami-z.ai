// ریست محدودیت‌های تست (OTP و سقف IP) برای اجرای تکراری آزمون‌های E2E — فقط محیط توسعه
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const TEST_MOBILES = ["09120000000", "09120000001", "09120000002", "09121111101", "09121111102"]

async function main() {
  const a = await db.otpCode.deleteMany({ where: { mobile: { in: TEST_MOBILES } } })
  const b = await db.loginLog.deleteMany({
    where: { method: "OTP", OR: [{ ip: { in: ["127.0.0.1", "::1", "localhost"] } }, { ip: null }] },
  })
  console.log(`✓ OTP rows cleared: ${a.count} · local IP OTP logs cleared: ${b.count}`)
}

main().catch((e) => { console.error("✗", e); process.exit(1) }).finally(() => db.$disconnect())
