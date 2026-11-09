// آزمون پورسانت معرفی: خرید با معرف → تأیید مدیر → پورسانت REFERRAL برای معرف
const BASE = "http://localhost:3000"

async function call(m, p, b, c) {
  const r = await fetch(BASE + p, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b ? JSON.stringify(b) : undefined })
  const j = await r.json().catch(() => null)
  return { status: r.status, json: j }
}

async function loginPassword(mobile, password) {
  const r = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, password }),
  })
  if (!r.ok) return null
  return r.headers.get("set-cookie").split(/,(?=[^;]+?=)/).map((c) => c.split(";")[0].trim()).join("; ")
}

async function loginOtp(mobile) {
  for (let i = 0; i < 5; i++) {
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
      return sc.split(/,(?=[^;]+?=)/).map((x) => x.split(";")[0].trim()).join("; ")
    }
    console.log(`  … انتظار OTP (${s.json?.error ?? "?"})`)
    await new Promise((r) => setTimeout(r, 95000))
  }
  throw new Error("OTP unavailable")
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
  console.log(`  ✓ ${msg}`)
}

const admin = await loginPassword("09120000000", "Hami@Admin123")
assert(!!admin, "ورود مدیر (رمز)")
const user = await loginOtp("09120000001")
assert(!!user, "ورود کاربر نمونه (OTP)")
const referrer = await loginOtp("09120000003")
assert(!!referrer, "ورود معرف نمونه (OTP)")

// خرید با معرف
const plans = (await call("GET", "/api/v1/public/plans", null, user)).json.data
const plan = plans.find((p) => p.title.includes("برنزی"))

// دارنده: خود کاربر (holder از قبل ساخته؟) — برای اطمینان، دارنده جدید
const holders = (await call("GET", "/api/v1/user/holders", null, user)).json.data
let holder = holders[0]
if (!holder) {
  const h = await call("POST", "/api/v1/user/holders", { firstName: "خریدار", lastName: "نمونه", nationalCode: "4234567893" }, user)
  holder = h.json.data.holder
}

// معرف نامعتبر باید رد شود (بدون نقش REFERRER) — از شماره مدیر استفاده می‌کنیم
const badRef = await call("POST", "/api/v1/user/purchases", { planId: plan.id, holderId: holder.id, referrerMobile: "09120000000" }, user)
assert(badRef.status === 422, "معرف بدون نقش «همکار معرفی» رد شد (REF-002)")

// خرید معتبر با معرف
const buy = await call("POST", "/api/v1/user/purchases", { planId: plan.id, holderId: holder.id, referrerMobile: "09120000003" }, user)
assert(buy.json?.ok, "خرید با معرف ثبت شد")
const purchaseId = buy.json.data.purchase.id

// تأیید مدیر → عضویت + پورسانت معرفی PENDING
const approve = await call("POST", "/api/v1/admin/purchases", { action: "approve", purchaseId }, admin)
assert(approve.json?.ok, "تأیید خرید توسط مدیر")

// بررسی پورسانت معرف
const refCommissions = (await call("GET", "/api/v1/agent/commissions", null, referrer)).json.data
const referral = refCommissions.items.find((c) => c.type === "REFERRAL" && c.status === "PENDING")
assert(!!referral, "پورسانت معرفی PENDING برای معرف ثبت شد (REF-005)")
assert(referral.amount === Math.round((350000 * 5) / 100), `مبلغ پورسانت معرفی درست است: ${referral.amount} = ۵٪ × ۳۵۰٬۰۰۰ (PLAN-003)`)

// تکرار تأیید همان خرید نباید پورسانت دوم بسازد
const approve2 = await call("POST", "/api/v1/admin/purchases", { action: "approve", purchaseId }, admin)
assert(approve2.status === 409, "تأیید تکراری خرید رد شد (PAY-006 · BR-15)")

console.log("\n🏁 زنجیره پورسانت معرفی درست کار کرد.")
