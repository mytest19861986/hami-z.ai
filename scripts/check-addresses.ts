// بررسی و به‌روزرسانی آدرس‌ها به مازندران/ساری
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("=== وضعیت فعلی پزشکان ===")
  const doctors = await db.doctor.findMany({
    select: { id: true, clinicName: true, province: true, city: true, userId: true },
  })
  for (const d of doctors) console.log(`${d.clinicName} | ${d.province} / ${d.city}`)

  console.log("\n=== پروفایل‌های دارای آدرس (UserProfile) ===")
  const profiles = await db.userProfile.findMany({
    select: { id: true, firstName: true, lastName: true, province: true, city: true },
    take: 40,
  })
  for (const p of profiles) console.log(`${p.firstName} ${p.lastName} | ${p.province} / ${p.city}`)

  console.log("\n=== نمایندگان (Agent) ===")
  const agents = await db.agent.findMany({ select: { id: true, province: true, city: true } })
  for (const a of agents) console.log(`agent#${a.id} | ${a.province} / ${a.city}`)

  console.log("\n=== محتوای صفحات (PageContent) ===")
  const contents = await db.pageContent.findMany()
  const withAddr = contents.filter((c) =>
    /تهران|اصفهان|شیراز|مشهد|تبریز|رشت|کرج|اهواز|یزد|قم|کرمان|آدرس|نشانی/.test(String(c.body ?? "") + String(c.title ?? ""))
  )
  console.log(
    withAddr.length
      ? withAddr.map((c) => `key=${c.key} title=${c.title}\n${String(c.body).slice(0, 300)}`).join("\n---\n")
      : "بدون آدرس در محتوا"
  )

  console.log("\n=== تنظیمات حاوی آدرس؟ ===")
  const settings = await db.setting.findMany()
  const addrSettings = settings.filter(
    (s) => /تهران|اصفهان|شیراز|مشهد|تبریز|رشت|کرج|اهواز|یزد|قم|کرمان/.test(String(s.value))
  )
  console.log(addrSettings.length ? addrSettings.map((s) => `${s.key}=${s.value}`).join("\n") : "—")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
