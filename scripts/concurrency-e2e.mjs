// آزمون همزمانی: مصرف سهمیه (AC-07/SEC-007) و تمدید نشست (AC-15/AUTH-011)
const BASE = "http://localhost:3000"

async function call(m, p, b, c) {
  const r = await fetch(BASE + p, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b ? JSON.stringify(b) : undefined })
  const j = await r.json().catch(() => null)
  return { status: r.status, json: j }
}

async function login(mobile) {
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
      if (!sc) throw new Error("no set-cookie")
      const cookies = sc.split(/,(?=[^;]+?=)/).map((x) => x.split(";")[0].trim())
      return { cookie: cookies.join("; "), raw: cookies }
    }
    console.log(`  … انتظار برای OTP (${s.json?.error ?? "?"})`)
    await new Promise((r) => setTimeout(r, 95000))
  }
  throw new Error("OTP unavailable")
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
  console.log(`  ✓ ${msg}`)
}

function fixCode(base9) {
  for (let c = 0; c <= 9; c++) {
    const nc = base9 + c
    const s = Array.from({ length: 9 }, (_, i) => parseInt(nc[i]) * (10 - i)).reduce((a, b) => a + b, 0)
    const r = s % 11
    const check = r < 2 ? r : 11 - r
    if (check === c) return nc
  }
  return null
}

async function main() {
  const admin = await login("09120000000")
  const doctor = await login("09121111101") // پزشک تأییدشده (قلب و عروق)
  console.log("🔑 ورود مدیر و پزشک")

  // طرح یک‌مصرفی می‌سازیم
  const planRes = await call("POST", "/api/v1/admin/plans", {
    title: "طرح تست یک‌مصرف (E2E)",
    description: "برای آزمون همزمانی — پس از تست غیرفعال می‌شود",
    price: 100000,
    durationDays: 30,
    discountPercent: 50,
    usageLimit: 1,
    salesCommissionPercent: 0,
    referralCommissionPercent: 0,
    isActive: true,
  }, admin.cookie)
  assert(planRes.json?.ok, "طرح یک‌مصرفی ایجاد شد")

  const holderCode = fixCode("323456789")
  const grantRes = await call("PATCH", "/api/v1/admin/plans", {
    action: "grant",
    planId: planRes.json.data.planId,
    firstName: "تست",
    lastName: "همزمانی",
    nationalCode: holderCode,
    reason: "آزمون AC-07",
  }, admin.cookie)
  assert(grantRes.json?.ok, "اعطای طرح یک‌مصرف به دارنده تست")

  // شناسه عضویت از طریق احراز شرایط پزشک
  const elig = await call("POST", "/api/v1/doctor/eligibility", { nationalCode: holderCode }, doctor.cookie)
  const membership = elig.json.data.memberships.find((m) => m.planTitle.includes("یک‌مصرف"))
  assert(!!membership && membership.remaining === 1, "عضویت با سهمیه ۱ شناخته شد")

  // دو ثبت ویزیت هم‌زمان روی همان سهمیه (AC-07)
  const [v1, v2] = await Promise.all([
    call("POST", "/api/v1/doctor/visits", { membershipId: membership.membershipId, totalAmount: 400000, note: "تست همزمان ۱" }, doctor.cookie),
    call("POST", "/api/v1/doctor/visits", { membershipId: membership.membershipId, totalAmount: 400000, note: "تست همزمان ۲" }, doctor.cookie),
  ])
  const successes = [v1, v2].filter((v) => v.json?.ok).length
  assert(successes === 1, `از دو ثبت هم‌زمان فقط ${successes} مورد موفق شد (AC-07 · BR-08 · SEC-007)`)
  const failed = [v1, v2].find((v) => !v.json?.ok)
  assert(failed?.status === 409, `درخواست ردشده خطای مناسب داد: «${failed.json.error}»`)

  // سهمیه اکنون صفر است؛ ثبت سومین ویزیت هم باید رد شود
  const v3 = await call("POST", "/api/v1/doctor/visits", { membershipId: membership.membershipId, totalAmount: 400000 }, doctor.cookie)
  assert(v3.status === 409, "ثبت ویزیت با سهمیه صفر رد شد (BR-07)")

  // غیرفعال‌سازی طرح تست
  const plans = (await call("GET", "/api/v1/admin/plans", null, admin.cookie)).json.data
  const testPlan = plans.find((p) => p.title.includes("یک‌مصرف"))
  const deactivate = await call("PUT", "/api/v1/admin/plans", {
    id: testPlan.id,
    title: testPlan.title,
    description: testPlan.description ?? "",
    price: testPlan.price,
    durationDays: testPlan.durationDays,
    discountPercent: testPlan.discountPercent,
    usageLimit: testPlan.usageLimit,
    salesCommissionPercent: testPlan.salesCommissionPercent,
    referralCommissionPercent: testPlan.referralCommissionPercent,
    features: testPlan.features ?? [],
    isActive: false,
  }, admin.cookie)
  assert(deactivate.json?.ok, "طرح تست غیرفعال شد (PLAN-005)")

  // ─── AC-15: رقابت تمدید نشست ───
  console.log("\n🔄 رقابت تمدید نشست (AC-15)…")
  const rtCookie = admin.raw.find((c) => c.startsWith("hk_rt="))
  assert(!!rtCookie, "کوکی تمدید موجود است")
  const refreshCall = () =>
    fetch(BASE + "/api/v1/auth/refresh", { method: "POST", headers: { Cookie: rtCookie } })
  const results = await Promise.all([refreshCall(), refreshCall(), refreshCall()])
  const okCount = results.filter((r) => r.status === 200).length
  assert(okCount === 1, `از ۳ درخواست هم‌زمان تمدید فقط ${okCount} مورد موفق شد (AUTH-011 · AC-15)`)
  const failedRefresh = results.filter((r) => r.status !== 200)
  assert(failedRefresh.length === 2, "درخواست‌های بازنده ۴۰۱ گرفتند — جانشین اضافی ساخته نشد")

  console.log("\n🏁 آزمون‌های همزمانی موفق بودند.")
}

main().catch((e) => {
  console.error("✗", e.message)
  process.exit(1)
})
