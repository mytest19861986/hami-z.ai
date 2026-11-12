// ─────────────────────────────────────────────────────────────────────────────
// تست سرتاسری «عملیات» بخش پزشکان ادمین:
// ۱) ورود ادمین  ۲) فیلدهای جدید لیست پزشکان  ۳) API آمار و بررسی (صحت با DB)
// ۴) ویرایش اطلاعات (round-trip + اعتبارسنجی شهر)  ۵) جریان تعلیق/تأیید
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client"

const BASE = "http://localhost:3000"
const ADMIN_MOBILE = "09120000000"
const ADMIN_PASSWORD = "Hami@Admin123"
const TARGET_DOCTOR_ID = process.env.E2E_DOCTOR ?? "cmw9gkh4s004bndmaqwpo8wi1" // آرش کریمی (۹ ویزیت)
const TEHRAN_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" })

const db = new PrismaClient()
const jar = new Map()
let failures = 0

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}
function check(name, cond, extra = "") {
  if (cond) {
    log(`PASS  ${name}${extra ? ` — ${extra}` : ""}`)
  } else {
    failures++
    log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`)
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
}
function absorbCookies(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []
  for (const c of list) {
    const pair = c.split(";")[0]
    const i = pair.indexOf("=")
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
}
async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookieHeader(), ...(init.headers ?? {}) },
  })
  absorbCookies(res)
  let body = null
  try {
    body = await res.json()
  } catch {}
  return { status: res.status, body: body ?? {} }
}

async function main() {
  // ۱) ورود ادمین
  const login = await call("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ mobile: ADMIN_MOBILE, password: ADMIN_PASSWORD }) })
  check("ورود ادمین", login.status === 200 && login.body?.ok === true, `status=${login.status}`)

  // ۲) لیست پزشکان — فیلدهای جدید
  const list = await call("/api/v1/admin/doctors?page=1")
  check("دریافت لیست پزشکان", list.status === 200 && Array.isArray(list.body?.data?.doctors))
  const row = list.body?.data?.doctors?.find((d) => d.id === TARGET_DOCTOR_ID)
  check("پزشک هدف در لیست موجود است", !!row)
  check("فیلدهای جدید در لیست (firstName/lastName/address/education/referrerDoctor)", row && "firstName" in row && "address" in row && "education" in row && "referrerDoctor" in row, JSON.stringify({ firstName: row?.firstName, lastName: row?.lastName, education: row?.education }))

  // ۳) آمار و بررسی — بازهٔ کل سال ۲۰۲۶ میلادی
  const from = "2026-01-01"
  const to = "2026-12-31"
  const stats = await call(`/api/v1/admin/doctors/stats?doctorId=${TARGET_DOCTOR_ID}&from=${from}&to=${to}`)
  check("GET stats موفق", stats.status === 200 && stats.body?.ok === true, `status=${stats.status} err=${stats.body?.error ?? ""}`)
  const t = stats.body?.data?.totals
  check("نام پزشک در پاسخ stats", stats.body?.data?.doctor?.name?.includes("آرش") === true, stats.body?.data?.doctor?.name)

  // صحت‌سنجی با دیتابیس — همان منطق تهران-محور
  const dbVisits = await db.visit.findMany({
    where: { doctorId: TARGET_DOCTOR_ID, visitDate: { gte: new Date(`${from}T00:00:00+03:30`), lte: new Date(`${to}T23:59:59.999+03:30`) } },
    select: { visitDate: true, status: true, discountAmount: true, holderId: true },
  })
  const dbHolders = new Set(dbVisits.map((v) => v.holderId))
  const dbDiscount = dbVisits.reduce((s, v) => s + v.discountAmount, 0)
  const dbDaily = {}
  for (const v of dbVisits) {
    const k = TEHRAN_DAY.format(v.visitDate)
    dbDaily[k] = (dbDaily[k] ?? 0) + 1
  }
  check(`تعداد کل ویزیت‌ها (${t?.visits} == ${dbVisits.length})`, t?.visits === dbVisits.length)
  check(`بیماران یکتا (${t?.patients} == ${dbHolders.size})`, t?.patients === dbHolders.size)
  check(`تکمیل‌شده (${t?.completed} == ${dbVisits.filter((v) => v.status === "COMPLETED").length})`, t?.completed === dbVisits.filter((v) => v.status === "COMPLETED").length)
  check(`تخفیف کل (${t?.discount} == ${dbDiscount})`, t?.discount === dbDiscount)
  check("روند روزانه با DB یکی است", JSON.stringify(stats.body?.data?.daily) === JSON.stringify(Object.entries(dbDaily).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))))
  check("بازه در پاسخ برمی‌گردد", stats.body?.data?.from === from && stats.body?.data?.to === to)

  // بازهٔ نامعتبر → ۴۲۲
  const badRange = await call(`/api/v1/admin/doctors/stats?doctorId=${TARGET_DOCTOR_ID}&from=2026-12-31&to=2026-01-01`)
  check("بازهٔ معکوس رد می‌شود (۴۲۲)", badRange.status === 422, `status=${badRange.status}`)

  // ۴) مشاهده/ویرایش اطلاعات — round-trip
  const doctorBefore = await db.doctor.findUnique({ where: { id: TARGET_DOCTOR_ID }, include: { user: { include: { profile: true } } } })
  const original = {
    firstName: doctorBefore.user.profile?.firstName ?? "",
    lastName: doctorBefore.user.profile?.lastName ?? "",
    address: doctorBefore.address ?? "",
    education: doctorBefore.education ?? "",
    clinicName: doctorBefore.clinicName ?? "",
    clinicAddress: doctorBefore.clinicAddress ?? "",
    clinicPhone: doctorBefore.clinicPhone ?? "",
    referrerDoctor: doctorBefore.referrerDoctor ?? "",
    province: doctorBefore.province ?? "",
    city: doctorBefore.city ?? "",
  }
  const updated = {
    firstName: "آرش",
    lastName: "کریمی آزمون",
    address: "ساری، بلوار فرهنگ",
    education: "متخصص قلب و عروق — بورد تخصصی",
    clinicName: "کلینیک قلب آرش (ویرایش تست)",
    clinicAddress: "ساری، خیابان ۱۸ دی",
    clinicPhone: "011-33334444",
    referrerDoctor: "دکتر معرف نمونه",
    province: "مازندران",
    city: "ساری",
  }
  const upd = await call("/api/v1/admin/doctors", { method: "POST", body: JSON.stringify({ action: "update_profile", doctorId: TARGET_DOCTOR_ID, ...updated }) })
  check("update_profile موفق", upd.status === 200 && upd.body?.ok === true, `status=${upd.status} err=${upd.body?.error ?? ""}`)
  const doctorAfter = await db.doctor.findUnique({ where: { id: TARGET_DOCTOR_ID }, include: { user: { include: { profile: true } } } })
  check("همهٔ فیلدهای Doctor ذخیره شدند", ["address", "education", "clinicName", "clinicAddress", "clinicPhone", "referrerDoctor", "province", "city"].every((k) => doctorAfter[k] === updated[k]))
  check("نام/نام خانوادگی روی پروفایل ذخیره شد", doctorAfter.user.profile?.firstName === updated.firstName && doctorAfter.user.profile?.lastName === updated.lastName)

  // رکورد ممیزی
  const lastAudit = await db.auditLog.findFirst({ where: { entityType: "DOCTOR", entityId: TARGET_DOCTOR_ID, action: "DOCTOR_PROFILE_UPDATE" }, orderBy: { createdAt: "desc" } })
  check("رکورد ممیزی DOCTOR_PROFILE_UPDATE ثبت شد", !!lastAudit)

  // شهر نامعتبر → ۴۲۲
  const badCity = await call("/api/v1/admin/doctors", { method: "POST", body: JSON.stringify({ action: "update_profile", doctorId: TARGET_DOCTOR_ID, province: "تهران", city: "ساری" }) })
  check("شهر نامتناسب با استان رد می‌شود (۴۲۲)", badCity.status === 422, `status=${badCity.status}`)

  // بازگردانی داده‌های اصلی
  const revert = await call("/api/v1/admin/doctors", { method: "POST", body: JSON.stringify({ action: "update_profile", doctorId: TARGET_DOCTOR_ID, ...original }) })
  check("بازگردانی داده‌های اصلی", revert.status === 200)
  const doctorRestored = await db.doctor.findUnique({ where: { id: TARGET_DOCTOR_ID }, include: { user: { include: { profile: true } } } })
  check("داده‌ها به حالت اول بازگشتند", ["address", "education", "referrerDoctor", "province", "city"].every((k) => (doctorRestored[k] ?? "") === original[k]) && doctorRestored.user.profile?.lastName === original.lastName)

  // ۵) جریان تعلیق/تأیید (منوی عملیات ← تعلیق)
  const testDoctorId = process.env.E2E_TEST_DOCTOR ?? "cmw9gkh6f0073ndmalprlpnnf" // «پزشک در حال بررسی» — دادهٔ آزمایشی seed
  const beforeStatus = await db.doctor.findUnique({ where: { id: testDoctorId }, select: { status: true } })
  if (beforeStatus?.status === "APPROVED") {
    const sus = await call("/api/v1/admin/doctors", { method: "POST", body: JSON.stringify({ action: "review", doctorId: testDoctorId, decision: "SUSPEND", reason: "تست E2E تعلیق از منوی عملیات" }) })
    check("تعلیق با دلیل موفق", sus.status === 200 && sus.body?.data?.status === "SUSPENDED", `status=${sus.status}`)
    const reasonRow = await db.doctor.findUnique({ where: { id: testDoctorId }, select: { rejectReason: true } })
    check("دلیل تعلیق ذخیره شد", reasonRow?.rejectReason === "تست E2E تعلیق از منوی عملیات")
    // تعلیق تکراری → ۴۰۹
    const susAgain = await call("/api/v1/admin/doctors", { method: "POST", body: JSON.stringify({ action: "review", doctorId: testDoctorId, decision: "SUSPEND", reason: "تکراری" }) })
    check("تعلیق تکراری ۴۰۹ می‌دهد", susAgain.status === 409)
    // بازگردانی به تأییدشده
    const reapprove = await call("/api/v1/admin/doctors", { method: "POST", body: JSON.stringify({ action: "review", doctorId: testDoctorId, decision: "APPROVE" }) })
    check("بازگردانی به تأییدشده", reapprove.status === 200)
    const restored = await db.doctor.findUnique({ where: { id: testDoctorId }, select: { status: true } })
    check("وضعیت نهایی = APPROVED", restored?.status === "APPROVED")
  } else {
    log(`SKIP  تست تعلیق — وضعیت پزشک آزمایشی: ${beforeStatus?.status ?? "?"}`)
  }

  // دسترسی بدون احراز هویت → ۴۰۱/۴۰۳
  const noAuth = await fetch(`${BASE}/api/v1/admin/doctors/stats?doctorId=${TARGET_DOCTOR_ID}&from=2026-01-01&to=2026-12-31`)
  check("stats بدون لاگین ۴۰۱ می‌دهد", noAuth.status === 401, `status=${noAuth.status}`)

  await db.$disconnect()
  log("──────────────────────────────")
  if (failures === 0) {
    log("همهٔ تست‌ها PASS شدند ✓")
    process.exit(0)
  } else {
    log(`${failures} تست FAIL شد ✗`)
    process.exit(1)
  }
}

main().catch(async (e) => {
  console.error("E2E crashed:", e)
  await db.$disconnect()
  process.exit(1)
})
