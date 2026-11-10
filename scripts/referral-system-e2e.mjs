// E2E: REF-SYS — قوانین اعتبارسنجی، الزام کد ملی، پورسانت رفرال کاربر/همکار، گیت بانکی
const BASE = "http://localhost:3000"
let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    console.log(`  ❌ ${msg}`)
  }
}

async function call(m, p, b, c) {
  const r = await fetch(BASE + p, {
    method: m,
    headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  })
  const j = await r.json().catch(() => null)
  return { status: r.status, json: j }
}

function cookieOf(r) {
  const sc = r.headers.get("set-cookie")
  if (!sc) return null
  return sc
    .split(/,(?=[^;]+?=)/)
    .map((x) => x.split(";")[0].trim())
    .join("; ")
}

async function loginPassword(mobile, password) {
  const r = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, password }),
  })
  if (!r.ok) throw new Error(`admin login failed: ${r.status}`)
  return cookieOf(r)
}

async function registerOtp(mobile, referralCode = "") {
  const s = await call("POST", "/api/v1/auth/send-otp", { mobile })
  const devCode = s.json?.data?.devCode
  if (!devCode) throw new Error(`OTP unavailable for ${mobile}: ${JSON.stringify(s.json)}`)
  const v = await fetch(BASE + "/api/v1/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, code: devCode, referralCode }),
  })
  const cookie = cookieOf(v)
  if (!cookie) throw new Error(`verify failed for ${mobile}`)
  return { cookie, res: await v.json() }
}

const A_MOB = "09351110001"
const B_MOB = "09351110002"
const C_MOB = "09351110003"
const D_MOB = "09351110004"
const AGENT_MOB = "09120000002"

async function main() {
  console.log("── ۱) ورود مدیر و تنظیم درصد پورسانت سراسری ──")
  const admin = await loginPassword("09120000000", "Hami@Admin123")
  const setRes = await call("PUT", "/api/v1/admin/settings", { key: "USER_REFERRAL_COMMISSION_PERCENT", value: "17" }, admin)
  assert(setRes.status === 200 && setRes.json?.ok, "تنظیم USER_REFERRAL_COMMISSION_PERCENT=17 توسط مدیر")
  const badSet = await call("PUT", "/api/v1/admin/settings", { key: "USER_REFERRAL_COMMISSION_PERCENT", value: "150" }, admin)
  assert(badSet.status === 422, "رد مقدار خارج از بازه (۱۵۰٪)")

  console.log("── ۲) ساخت طرح تست با پورسانت همکار ۲۲٪ و معرفی طرح ۰٪ ──")
  const planRes = await call(
    "POST",
    "/api/v1/admin/plans",
    {
      title: `طرح E2E رفرال ${Date.now() % 100000}`,
      description: "آزمون سامانه رفرال",
      price: 1000000,
      durationDays: 30,
      discountPercent: 15,
      usageLimit: 3,
      salesCommissionPercent: 22,
      referralCommissionPercent: 0,
      isActive: true,
      sortOrder: 90,
    },
    admin
  )
  assert(planRes.status === 200 && planRes.json?.ok, "ساخت طرح تست")
  const planId = planRes.json.data.planId

  console.log("── ۳) ثبت‌نام A (معرف) بدون کد ──")
  const A = await registerOtp(A_MOB)
  const aProfile = await call("GET", "/api/v1/user/profile", null, A.cookie)
  const aCode = aProfile.json?.data?.referral?.code
  assert(!!aCode, `A کد رفرال یکتا گرفت: ${aCode}`)
  assert(aProfile.json?.data?.referral?.referredBy === null, "A معرفی‌شده نیست")

  console.log("── ۴) ثبت‌نام B با کد رفرال A ──")
  const B = await registerOtp(B_MOB, aCode)
  const bProfile = await call("GET", "/api/v1/user/profile", null, B.cookie)
  assert(!!bProfile.json?.data?.referral?.referredBy, `B به معرف متصل شد: ${bProfile.json?.data?.referral?.referredBy?.name}`)
  assert(!!bProfile.json?.data?.referral?.code, "B هم کد رفرال گرفت")
  assert(bProfile.json?.data?.referral?.bankInfoComplete === false, "وضعیت بانکی ناقص B درست گزارش شد")

  console.log("── ۵) قوانین اعتبارسنجی (بدون رقم کنترل) ──")
  let r = await call("PUT", "/api/v1/user/profile", { nationalCode: "123456789" }, B.cookie)
  assert(r.status === 422, "کد ملی ۹ رقمی رد شد")
  r = await call("PUT", "/api/v1/user/profile", { nationalCode: "1111111111" }, B.cookie)
  assert(r.status === 200, "کد ملی ۱۰ رقمی بدون رقم کنترل پذیرفته شد (۱۱۱۱۱۱۱۱۱۱)")
  r = await call("PUT", "/api/v1/user/profile", { cardNumber: "621986101234567" }, B.cookie)
  assert(r.status === 422, "کارت ۱۵ رقمی رد شد")
  r = await call("PUT", "/api/v1/user/profile", { cardNumber: "6219861012345678" }, B.cookie)
  assert(r.status === 200, "کارت ۱۶ رقمی بدون الگوریتم Luhn پذیرفته شد")
  r = await call("PUT", "/api/v1/user/profile", { sheba: "IR01234567890123456789012" }, B.cookie)
  assert(r.status === 422, "شبا ۲۳ رقمی رد شد")
  r = await call("PUT", "/api/v1/user/profile", { sheba: "IR012345678901234567890123" }, B.cookie)
  assert(r.status === 200, "شبا ۲۴ رقمی بدون رقم کنترل پذیرفته شد")
  r = await call("POST", "/api/v1/auth/send-otp", { mobile: "9351110005" })
  assert(r.status === 200, "موبایل ۱۰ رقمی بدون صفر پذیرفته شد")
  r = await call("POST", "/api/v1/auth/send-otp", { mobile: "09351110006" })
  assert(r.status === 200, "موبایل ۱۱ رقمی با صفر پذیرفته شد")
  r = await call("POST", "/api/v1/auth/send-otp", { mobile: "12345" })
  assert(r.status === 422, "موبایل کوتاه رد شد")

  console.log("── ۶) الزام کد ملی خریدار ──")
  const D = await registerOtp(D_MOB)
  const dHolder = await call("POST", "/api/v1/user/holders", { firstName: "بدون", lastName: "کدملی", nationalCode: "2222222222" }, D.cookie)
  assert(dHolder.status === 200, "D دارنده ساخت")
  r = await call("POST", "/api/v1/user/purchases", { planId, holderId: dHolder.json.data.holder.id }, D.cookie)
  assert(r.status === 422 && r.json?.needNationalCode, "خرید بدون کد ملی خریدار رد شد (needNationalCode)")

  console.log("── ۷) خرید B با کد ملی و تأیید مدیر ──")
  const bHolder = await call("POST", "/api/v1/user/holders", { firstName: "خریدار", lastName: "رفرالی", nationalCode: "3333333333" }, B.cookie)
  assert(bHolder.status === 200, "B دارنده ساخت")
  r = await call("POST", "/api/v1/user/purchases", { planId, holderId: bHolder.json.data.holder.id }, B.cookie)
  assert(r.status === 200 && r.json?.ok, `B خرید ثبت کرد (${r.json?.data?.purchase?.trackingCode ?? "?"})`)
  const purchaseTracking = r.json.data.purchase.trackingCode

  const pend = await call("GET", "/api/v1/admin/purchases?status=PENDING", null, admin)
  const target = pend.json.data.purchases.find((p) => p.trackingCode === purchaseTracking)
  assert(!!target, "خرید B در صف تأیید مدیر دیده شد")
  r = await call("POST", "/api/v1/admin/purchases", { action: "approve", purchaseId: target.id }, admin)
  assert(r.status === 200 && r.json?.ok, "مدیر خرید B را تأیید کرد")

  console.log("── ۸) پورسانت رفرال A با درصد سراسری ۱۷٪ ──")
  const aComms = await call("GET", "/api/v1/agent/commissions", null, A.cookie)
  const aRef = (aComms.json.data.items ?? []).find((c) => c.status === "PENDING" && c.type === "REFERRAL")
  assert(!!aRef, "پورسانت REFERRAL برای A ثبت شد")
  assert(aRef?.percent === 17, `درصد پورسانت = ۱۷ (سراسری): ${aRef?.percent}`)
  assert(aRef?.amount === 170000, `مبلغ پورسانت = ۱۷۰٬۰۰۰: ${aRef?.amount}`)

  console.log("── ۹) گیت اطلاعات بانکی در تأیید پورسانت ──")
  const adminComms = await call("GET", "/api/v1/admin/commissions?status=PENDING", null, admin)
  const aRow = adminComms.json.data.commissions.find((c) => c.beneficiaryMobile === A_MOB)
  assert(!!aRow && aRow.bankInfoComplete === false, "ادمین نشانگر «بدون کارت/شبا» را می‌بیند")
  r = await call("POST", "/api/v1/admin/commissions", { commissionId: aRow.id, decision: "APPROVE" }, admin)
  assert(r.status === 409, "تأیید پورسانت بدون کارت/شبا بلوکه شد (۴۰۹)")

  console.log("── ۱۰) تکمیل بانکی A و واریز پورسانت ──")
  r = await call("PUT", "/api/v1/user/profile", { cardNumber: "6219861098765432", sheba: "IR987654321098765432109876", bankAccountName: "کاربر الف تست" }, A.cookie)
  assert(r.status === 200, "A کارت/شبا تکمیل کرد")
  r = await call("POST", "/api/v1/admin/commissions", { commissionId: aRow.id, decision: "APPROVE" }, admin)
  assert(r.status === 200, "تأیید پورسانت پس از تکمیل بانکی موفق شد")
  const aWallet = await call("GET", "/api/v1/agent/wallet", null, A.cookie)
  assert(aWallet.json.data.withdrawableBalance === 170000, `کیف پول A = ۱۷۰٬۰۰۰: ${aWallet.json.data.withdrawableBalance}`)

  console.log("── ۱۱) تسویه A ──")
  r = await call("POST", "/api/v1/agent/settlements", { amount: 170000 }, A.cookie)
  assert(r.status === 200 && r.json?.ok, "درخواست تسویه A ثبت شد")
  const aWallet2 = await call("GET", "/api/v1/agent/wallet", null, A.cookie)
  assert(aWallet2.json.data.withdrawableBalance === 0 && aWallet2.json.data.heldBalance === 170000, "مانده نگه‌داشته شد")

  console.log("── ۱۲) رفرال همکار فروش: درصد اختصاصی طرح (۲۲٪) ──")
  const AG = await registerOtp(AGENT_MOB)
  const agProfile = await call("GET", "/api/v1/user/profile", null, AG.cookie)
  const agCode = agProfile.json?.data?.referral?.code
  assert(!!agCode, `کد رفرال همکار فروش: ${agCode}`)
  const C = await registerOtp(C_MOB, agCode)
  r = await call("PUT", "/api/v1/user/profile", { nationalCode: "4444444444" }, C.cookie)
  assert(r.status === 200, "C کد ملی تکمیل کرد")
  const cHolder = await call("POST", "/api/v1/user/holders", { firstName: "خریدار", lastName: "همکری", nationalCode: "5555555555" }, C.cookie)
  r = await call("POST", "/api/v1/user/purchases", { planId, holderId: cHolder.json.data.holder.id }, C.cookie)
  assert(r.status === 200, "C خرید ثبت کرد")
  const cTrack = r.json.data.purchase.trackingCode
  const pend2 = await call("GET", "/api/v1/admin/purchases?status=PENDING", null, admin)
  const target2 = pend2.json.data.purchases.find((p) => p.trackingCode === cTrack)
  r = await call("POST", "/api/v1/admin/purchases", { action: "approve", purchaseId: target2.id }, admin)
  assert(r.status === 200, "مدیر خرید C را تأیید کرد")
  const agComms = await call("GET", "/api/v1/agent/commissions?type=REFERRAL", null, AG.cookie)
  const agRef = (agComms.json.data.items ?? []).find((c) => c.status === "PENDING")
  assert(!!agRef, "پورسانت REFERRAL برای همکار فروش ثبت شد")
  assert(agRef?.percent === 22, `درصد پورسانت همکار = ۲۲ (درصد طرح): ${agRef?.percent}`)
  assert(agRef?.amount === 220000, `مبلغ = ۲۲۰٬۰۰۰: ${agRef?.amount}`)

  console.log(`\n═══ نتیجه: ${passed} پاس / ${failed} خطا ═══`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error("💥 خطای اجرا:", e.message)
  process.exit(1)
})
