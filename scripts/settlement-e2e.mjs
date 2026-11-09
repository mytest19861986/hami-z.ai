// ادامه تست زنجیره مالی — تسویه (از وضعیت فعلی DB: پورسانت تأییدشده ۱۸۰٬۰۰۰ در کیف پول نماینده)
const BASE = "http://localhost:3000"

async function call(m, p, b, c) {
  const r = await fetch(BASE + p, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b ? JSON.stringify(b) : undefined })
  const j = await r.json().catch(() => null)
  return { status: r.status, json: j }
}

async function login(mobile) {
  // تلاش با فاصله برای عبور از Cooldown
  for (let i = 0; i < 6; i++) {
    const s = await call("POST", "/api/v1/auth/send-otp", { mobile })
    const devCode = s.json?.data?.devCode
    if (devCode) {
      const v = await fetch(BASE + "/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code: devCode }),
      })
      const sc = v.headers.get("set-cookie")
      if (!sc) throw new Error("no set-cookie on verify")
      return sc.split(/,(?=[^;]+?=)/).map((c) => c.split(";")[0].trim()).join("; ")
    }
    console.log(`  … کد OTP در دسترس نیست (${s.json?.error ?? "?"}) — انتظار ۹۵ ثانیه`)
    await new Promise((r) => setTimeout(r, 95000))
  }
  throw new Error("OTP unavailable after retries")
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
  console.log(`  ✓ ${msg}`)
}

function luhnValid(card) {
  let s = 0
  for (let i = 0; i < 16; i++) {
    let d = parseInt(card[i])
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    s += d
  }
  return s % 10 === 0
}
function shebaValid(s) {
  const r = s.slice(2) + "1827"
  let rem = 0
  for (const ch of r) rem = (rem * 10 + parseInt(ch)) % 97
  return rem === 1
}

const admin = await login("09120000000")
const agent = await login("09120000002")
console.log("🔑 ورود مدیر و نماینده")

// وضعیت کیف پول فعلی
const wallet0 = (await call("GET", "/api/v1/agent/wallet", null, agent)).json.data
console.log(`💰 مانده فعلی نماینده: قابل‌برداشت=${wallet0.withdrawableBalance} نگهداشت=${wallet0.heldBalance}`)
assert(wallet0.withdrawableBalance >= 180000, "مانده قابل برداشت ≥ ۱۸۰٬۰۰۰ (از تست قبلی)")

// ۱) تسویه بدون اطلاعات بانکی
console.log("\n🏦 تسویه…")
const noBank = await call("POST", "/api/v1/agent/settlements", { amount: 180000 }, agent)
assert(noBank.status === 409 && String(noBank.json.error).includes("صاحب حساب"), `درخواست بدون اطلاعات بانکی رد شد: «${noBank.json.error}» (SETTLE-002)`)

// ۲) تکمیل بانکی — کارت/شبای معتبر
let card = null
for (let c = 0; c <= 9 && !card; c++) {
  const cand = "621986101234567" + c
  if (luhnValid(cand)) card = cand
}
let sheba = null
outer: for (let n = 0; n < 1000; n++) {
  const body = ("0170000000" + String(n)).padEnd(24, "0").slice(0, 24)
  const cand = "IR" + body
  if (shebaValid(cand)) {
    sheba = cand
    break outer
  }
}
assert(!!card && !!sheba, `کارت/شبای معتبر: ${card} / ${sheba?.slice(0, 8)}…`)

const profileRes = await call("PUT", "/api/v1/user/profile", { cardNumber: card, sheba, bankAccountName: "نماینده نمونه" }, agent)
assert(profileRes.json?.ok, "ثبت اطلاعات بانکی معتبر در پروفایل")

const badProfile = await call("PUT", "/api/v1/user/profile", { cardNumber: "1111111111111111" }, agent)
assert(badProfile.status === 422, "کارت نامعتبر Luhn رد شد (PROFILE-008)")
const badSheba = await call("PUT", "/api/v1/user/profile", { sheba: "IR120000000000000000000001" }, agent)
assert(badSheba.status === 422 || badSheba.json?.ok === false, "شبای نامعتبر mod-97 رد شد (PROFILE-008)")

// ۳) حدود مبلغ
const minFail = await call("POST", "/api/v1/agent/settlements", { amount: 50000 }, agent)
assert(minFail.status === 409, "کمتر از حداقل مبلغ رد شد (SETTLE-004 · OPEN-06)")
const tooMuch = await call("POST", "/api/v1/agent/settlements", { amount: 999999999 }, agent)
assert(tooMuch.status === 409, "بیش از مانده رد شد (SETTLE-004)")

// ۴) ثبت تسویه + یکتایی درخواست باز
const amount = wallet0.withdrawableBalance
const settle = await call("POST", "/api/v1/agent/settlements", { amount }, agent)
assert(settle.json?.ok, `درخواست تسویه ${amount} ثبت شد`)
const settleDup = await call("POST", "/api/v1/agent/settlements", { amount: 100000 }, agent)
assert(settleDup.status === 409, "درخواست دوم هم‌زمان رد شد (SETTLE-005 · AC-12)")

const walletAfter = (await call("GET", "/api/v1/agent/wallet", null, agent)).json.data
assert(walletAfter.withdrawableBalance === 0 && walletAfter.heldBalance === amount, "مانده صحیح به نگهداشت منتقل شد (WALLET)")

// ۵) چرخه مدیر: تأیید → پرداخت (SUPER_ADMIN)
const settlementId = settle.json.data.settlementId
const review = await call("POST", "/api/v1/admin/settlements", { action: "review", settlementId, decision: "APPROVE" }, admin)
assert(review.json?.ok, "تأیید درخواست تسویه توسط مدیر")
const paid = await call("POST", "/api/v1/admin/settlements", { action: "mark_paid", settlementId, paymentTrackingCode: "TRF-999" }, admin)
assert(paid.json?.ok, "ثبت پرداخت‌شده توسط مدیر ارشد (ADMIN-020 · SETTLE-008)")

const walletFinal = (await call("GET", "/api/v1/agent/wallet", null, agent)).json.data
assert(walletFinal.withdrawableBalance === 0 && walletFinal.heldBalance === 0, "پس از ثبت پرداخت، نگهداشت صفر شد (BR-20)")

const commissionsFinal = (await call("GET", "/api/v1/agent/commissions", null, agent)).json.data
const paidCommission = commissionsFinal.items.find((c) => c.type === "SALE" && c.status === "PAID")
assert(!!paidCommission, "پورسانت به حالت پرداخت‌شده رفت (FIFO · REF-007 · REPORT-006)")

// ۶) لغو توسط کاربر در وضعیت PENDING — با درخواست جدید نمی‌سازیم چون مانده صفر شد؛ فقط بررسی رد درخواست ناموجود
const fakeCancel = await call("DELETE", "/api/v1/agent/settlements", { id: "nonexistent" }, agent)
assert(fakeCancel.status === 404, "لغو درخواست ناموجود رد شد")

console.log("\n🏁 زنجیره تسویه کامل و درست کار کرد.")
