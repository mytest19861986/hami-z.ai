// مهاجرت آدرس‌های دیتابیس به مازندران / ساری (RUN-HAMICARD-001 / بومی‌سازی ساری)
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const PROVINCE = "مازندران"
const CITY = "ساری"

// خیابان‌های واقعی/پرحرف‌وار ساری برای تنوع دادهٔ نمایشی
const SARI_STREETS = [
  "خیابان ۱۸ دی",
  "خیابان فرهنگ",
  "خیابان سعدی",
  "بلوار طالب",
  "خیابان شیخ طبری",
  "خیابان انقلاب",
  "بلوار پاسداران",
  "خیابان قائم",
  "خیابان فرجام",
  "بلوار فجر",
  "خیابان ناصری (ساری)",
]

async function main() {
  // ۱) پزشکان: استان/شهر + آدرس مطب + تلفن مطب (پیش‌شمارهٔ ساری ۰۱۱)
  const doctors = await db.doctor.findMany({ select: { id: true, clinicName: true } })
  let i = 0
  for (const d of doctors) {
    const street = SARI_STREETS[i % SARI_STREETS.length]
    const plak = 10 + ((i * 7) % 90)
    await db.doctor.update({
      where: { id: d.id },
      data: {
        province: PROVINCE,
        city: CITY,
        clinicAddress: `${CITY}، ${street}، پلاک ${plak}`,
        clinicPhone: `01133334${(40 + i).toString().padStart(2, "0")}`,
      },
    })
    i++
  }
  console.log(`✅ پزشکان: ${doctors.length} رکورد → مازندران/ساری`)

  // ۲) پروفایل همهٔ کاربران
  const p = await db.userProfile.updateMany({ data: { province: PROVINCE, city: CITY } })
  console.log(`✅ پروفایل کاربران: ${p.count} رکورد`)

  // ۳) نمایندگان
  const a = await db.agent.updateMany({ data: { province: PROVINCE, city: CITY } })
  console.log(`✅ نمایندگان: ${a.count} رکورد`)

  // ۴) آدرس مشتریان نمایندگان (تهران‌زدایی)
  const sc = await db.saleCustomer.updateMany({
    where: { address: { contains: "تهران" } },
    data: { address: `${PROVINCE}، ${CITY}` },
  })
  console.log(`✅ آدرس مشتریان: ${sc.count} رکورد تهران‌زدایی شد`)

  // ۵) صفحهٔ تماس با ما
  const contactBody = `برای ارتباط با تیم پشتیبانی حامی‌کارت از راه‌های زیر استفاده کنید:\n\nتلفن پشتیبانی: ۰۱۱-۳۳۳۳۴۴۴۴ (شنبه تا پنجشنبه، ۹ تا ۱۸)\nایمیل: info@hamikart.ir\nنشانی: مازندران، ساری، خیابان ۱۸ دی، پلاک ۱۲۳\n\nهمچنین می‌توانید از فرم «ثبت درخواست پشتیبانی» در پنل کاربری خود استفاده کنید.`
  await db.pageContent.update({
    where: { pageKey: "contact" },
    data: { body: contactBody },
  })
  console.log("✅ صفحهٔ تماس با ما → ساری")

  // ۶) تنظیم تلفن تماس
  await db.setting.update({
    where: { key: "CONTACT_PHONE" },
    data: { value: "۰۱۱-۳۳۳۳۴۴۴۴" },
  }).catch(() => console.log("⚠️ تنظیم CONTACT_PHONE یافت نشد (در seed ساخته می‌شود)"))
  console.log("✅ تلفن تماس → ۰۱۱-۳۳۳۳۴۴۴۴")

  // ── راستی‌آزمایی ─
  const bad = await db.doctor.findMany({
    where: { OR: [{ province: { not: PROVINCE } }, { city: { not: CITY } }] },
    select: { clinicName: true },
  })
  console.log(bad.length === 0 ? "🎯 راستی‌آزمایی: همهٔ پزشکان مازندران/ساری هستند" : `❌ ${bad.length} پزشک ناهمگام!`)
  const sample = await db.doctor.findFirst({ select: { clinicName: true, province: true, city: true, clinicAddress: true } })
  console.log("نمونه:", JSON.stringify(sample, null, 1))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
