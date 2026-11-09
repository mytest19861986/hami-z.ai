// آزمون جامع سطوح کاربری و اینوارینت‌های مالی (TASK-GLM-002)
// پوشش: SURF-DOCTOR (استعلام کد ملی + موبایل و ثبت ویزیت)
//        SURF-AGENT (ثبت مشتری، چرخه کارت تا قطعی‌شدن، پورسانت، کیف پول، تسویه)
//        SURF-USER (سریال کارت) · SETTLE-005 · WALLET-006 · AUTH-011 · OPEN-01..18
const BASE = "http://localhost:3000"

async function call(m, p, b, c) {
  const r = await fetch(BASE + p, {
    method: m,
    headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  })
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

function luhnValid(s) {
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    let d = parseInt(s[s.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

function shebaValid(s) {
  const r = s.slice(2) + "1827"
  let rem = 0
  for (const ch of r) rem = (rem * 10 + parseInt(ch)) % 97
  return rem === 1
}

async function main() {
  console.log("🔑 ورود حساب‌های تست…")
  const admin = await login("09120000000")
  const doctor = await login("09121111101") // پزشک تأییدشده
  const agent = await login("09120000002") // نماینده تأییدشده
  const user = await login("09120000001") // کاربر عادی
  console.log("✓ مدیر / پزشک / نماینده / کاربر وارد شدند")

  const plans = (await call("GET", "/api/v1/public/plans", null, null)).json.data
  const golden = plans.find((p) => p.title.includes("طلایی")) ?? plans[0]
  assert(!!golden, `طرح فعال برای سناریو: «${golden.title}» (${golden.price.toLocaleString("fa-IR")} تومان)`)

  // ═══════════ SURF-AGENT: ثبت مشتری و چرخه کامل فروش ═══════════
  console.log("\n🤝 سطح نماینده — ثبت مشتری و چرخه فروش…")
  const custCode = fixCode(String(Date.now()).slice(-9))
  const custMobile = "0935" + String(Date.now()).slice(-7).padStart(7, "0")
  const reg = await call("POST", "/api/v1/agent/customers", {
    firstName: "علی",
    lastName: "رضایی",
    nationalCode: custCode,
    mobile: custMobile,
    planId: golden.id,
    address: "تهران، خیابان آزادی، پلاک ۱۲",
    postalCode: "1234567890",
  }, agent.cookie)
  assert(reg.json?.ok, "پرونده مشتری جدید ثبت شد (PENDING_REVIEW)")

  const dup = await call("POST", "/api/v1/agent/customers", {
    firstName: "علی",
    lastName: "رضایی",
    nationalCode: custCode,
    planId: golden.id,
    address: "تهران، خیابان آزادی، پلاک ۱۲",
  }, agent.cookie)
  assert(dup.status === 409, "ثبت پرونده تکراری همان طرح رد شد (409)")

  const salesList = (await call("GET", "/api/v1/admin/sales?q=" + encodeURIComponent(custCode), null, admin.cookie)).json.data
  const sale = salesList.sales?.find((s) => s.holderNationalCode === custCode)
  assert(!!sale, `پرونده فروش در داشبورد مدیر دیده می‌شود (وضعیت: ${sale.status})`)

  // چرخه کارت: تأیید → صدور → ارسال → تحویل → ثبت پرداخت → قطعی (OPEN-03: FINALIZED)
  let card = null
  for (let c = 0; c <= 9 && !card; c++) {
    const cand = "621986101234567" + c
    if (luhnValid(cand)) card = cand
  }
  const trans = (to, extra = {}) =>
    call("POST", "/api/v1/admin/sales", { action: "transition", saleId: sale.id, to, ...extra }, admin.cookie)
  assert((await trans("APPROVED")).json?.ok, "مرحله ۱/۶ — تأیید پرونده")
  assert((await trans("CARD_ISSUED", { cardNumber: card })).json?.ok, "مرحله ۲/۶ — صدور کارت فیزیکی")
  assert((await trans("SENT")).json?.ok, "مرحله ۳/۶ — ارسال")
  assert((await trans("DELIVERED")).json?.ok, "مرحله ۴/۶ — تحویل")
  const pay = await call("POST", "/api/v1/admin/sales", {
    action: "register_payment",
    saleId: sale.id,
    amount: golden.price,
    paymentTrackingCode: "PAY-E2E-" + Date.now().toString(36).toUpperCase(),
  }, admin.cookie)
  assert(pay.json?.ok, "مرحله ۵/۶ — ثبت پرداخت فروش")
  assert((await trans("FINALIZED")).json?.ok, "مرحله ۶/۶ — قطعی‌شدن فروش؛ عضویت + پورسانت ساخته شد (OPEN-03)")

  const dupFinalize = await trans("FINALIZED")
  assert(dupFinalize.status === 409, "قطعی‌سازی دوباره همان فروش رد شد (SALE-010 · تک‌عضویت)")

  // ═══════════ SURF-DOCTOR: استعلام کد ملی + موبایل و ثبت ویزیت ═══════════
  console.log("\n🩺 سطح پزشک — استعلام دارنده (کد ملی + موبایل)…")
  const elig1 = await call("POST", "/api/v1/doctor/eligibility", { nationalCode: custCode }, doctor.cookie)
  assert(elig1.json?.ok && elig1.json.data.found === true, "استعلام با کد ملی موفق بود")
  const membership = elig1.json.data.memberships[0]
  assert(!!membership && membership.eligible, `عضویت فعال شناسایی شد — باقی‌مانده: ${membership.remaining ?? "نامحدود"}`)

  const elig2 = await call("POST", "/api/v1/doctor/eligibility", { mobile: custMobile }, doctor.cookie)
  assert(elig2.json?.ok && elig2.json.data.found === true, "استعلام فقط با شماره همراه موفق بود (قابلیت جدید SURF-DOCTOR)")
  assert(elig2.json.data.holder.nationalCode === custCode, "همان دارنده از مسیر موبایل یافت شد")

  const elig3 = await call("POST", "/api/v1/doctor/eligibility", {}, doctor.cookie)
  assert(elig3.status === 422, "استعلام بدون کد ملی و موبایل با خطای اعتبارسنجی رد شد")

  const elig4 = await call("POST", "/api/v1/doctor/eligibility", { mobile: "09120000001" }, doctor.cookie)
  assert(elig4.json?.ok && elig4.json.data.found === false, "موبایل بدون عضویت فعال → «دارنده یافت نشد» (نه خطای سرور)")

  const visit = await call("POST", "/api/v1/doctor/visits", {
    membershipId: membership.membershipId,
    totalAmount: 500000,
    note: "ویزیت E2E سطوح کاربری",
  }, doctor.cookie)
  assert(visit.json?.ok, "ویزیت ثبت و سهمیه اتمیک مصرف شد (BR-08)")
  // دکتر رستمی (seed) تخفیف اختصاصی ۲۵٪ دارد → طبق پیش‌فرض OPEN-02 (DOCTOR) مقدم بر ۳۰٪ طرح است
  assert(
    visit.json.data.visit.discountBase === "DOCTOR" && visit.json.data.visit.discountPercent === 25,
    `مبنای تخفیف = درصد اختصاصی پزشک ${visit.json.data.visit.discountPercent}٪ (تقدم بر ${golden.discountPercent}٪ طرح — OPEN-02)`
  )
  assert(visit.json.data.visit.finalAmount === 500000 - visit.json.data.visit.discountAmount, "محاسبه مبلغ نهایی درست است")

  // ═══════════ SURF-USER: سریال کارت مجازی ═══════════
  console.log("\n💳 سطح کاربر — کارت مجازی و سریال…")
  const memberships = (await call("GET", "/api/v1/user/memberships", null, user.cookie)).json.data
  const withSerial = memberships.filter((m) => m.cardSerial)
  assert(withSerial.length > 0, `کاربر عضویت‌های دارای سریال کارت می‌بیند: ${withSerial.length} مورد`)
  assert(/^HK \d{4} \d{4} \d{4}$/.test(withSerial[0].cardSerial), `قالب سریال استاندارد است: «${withSerial[0].cardSerial}»`)

  // ═══════════ پورسانت → کیف پول (WALLET-002/006) ═══════════
  console.log("\n💰 پورسانت فروش و کیف پول نماینده…")
  const commissions = (await call("GET", "/api/v1/agent/commissions", null, agent.cookie)).json.data
  const pending = commissions.byStatus?.find((s) => s.status === "PENDING")
  assert(!!pending && pending.total > 0, `پورسانت فروش در انتظار تأیید: ${pending.total.toLocaleString("fa-IR")} تومان (${pending.count} مورد)`)

  const adminCommissions = (await call("GET", "/api/v1/admin/commissions?status=PENDING", null, admin.cookie)).json.data
  const target = adminCommissions.commissions?.find((c) => c.beneficiaryMobile === "09120000002")
  assert(!!target, "پورسانت نماینده در صف بررسی مدیر است")

  const approve = await call("POST", "/api/v1/admin/commissions", { commissionId: target.id, decision: "APPROVE" }, admin.cookie)
  assert(approve.json?.ok, "پورسانت تأیید شد → به کیف پول واریز شد (WALLET-002)")

  // WALLET-006: تأیید مجدد همان پورسانت نباید دوباره واریز کند
  const wallet1 = (await call("GET", "/api/v1/agent/wallet", null, agent.cookie)).json.data
  const reApprove = await call("POST", "/api/v1/admin/commissions", { commissionId: target.id, decision: "APPROVE" }, admin.cookie)
  const wallet2 = (await call("GET", "/api/v1/agent/wallet", null, agent.cookie)).json.data
  assert(reApprove.status === 409 && wallet2.withdrawableBalance === wallet1.withdrawableBalance,
    `تأیید مجدد پورسانت موجودی را تغییر نداد (${wallet1.withdrawableBalance.toLocaleString("fa-IR")} → ${wallet2.withdrawableBalance.toLocaleString("fa-IR")}) — WALLET-006 idempotent`)

  // ═══════════ SETTLE-005: یک درخواست باز تسویه ═══════════
  console.log("\n🏦 تسویه نماینده (حداقل ۱۰۰٬۰۰۰ تومان — OPEN-06)…")
  let sheba = null
  outer: for (let n = 0; n < 2000; n++) {
    const body = ("0170000000" + String(n)).padEnd(24, "0").slice(0, 24)
    const cand = "IR" + body
    if (shebaValid(cand)) { sheba = cand; break outer }
  }
  const profileRes = await call("PUT", "/api/v1/user/profile", {
    cardNumber: card,
    sheba,
    bankAccountName: "نماینده آزمون سطوح",
  }, agent.cookie)
  assert(profileRes.json?.ok, "اطلاعات بانکی نماینده تکمیل شد (PROFILE-007)")

  if (wallet2.withdrawableBalance >= 100000) {
    const amount = Math.min(wallet2.withdrawableBalance, 120000)
    const s1 = await call("POST", "/api/v1/agent/settlements", { amount }, agent.cookie)
    assert(s1.json?.ok, `درخواست تسویه ${amount.toLocaleString("fa-IR")} تومانی ثبت شد (HOLD اتمیک)`)

    const [s2a, s2b] = await Promise.all([
      call("POST", "/api/v1/agent/settlements", { amount: 100000 }, agent.cookie),
      call("POST", "/api/v1/agent/settlements", { amount: 100000 }, agent.cookie),
    ])
    const rejected = [s2a, s2b].filter((s) => s.status === 409).length
    assert(rejected === 2, `درخواست‌های هم‌زمان بعدی هر دو رد شدند (SETTLE-005 · ${rejected}/2)`)

    const list = (await call("GET", "/api/v1/agent/settlements", null, agent.cookie)).json.data
    const open = list.find((s) => s.status === "PENDING")
    const cancel = await call("DELETE", "/api/v1/agent/settlements", { id: open.id }, agent.cookie)
    assert(cancel.json?.ok, "درخواست باز لغو و مبلغ آزاد شد (SETTLE-006)")
    const wallet3 = (await call("GET", "/api/v1/agent/wallet", null, agent.cookie)).json.data
    assert(wallet3.withdrawableBalance === wallet2.withdrawableBalance, "مانده قابل برداشت پس از لغو به‌طور کامل بازگشت")
  } else {
    console.log(`  ⚠ مانده قابل برداشت ${wallet2.withdrawableBalance.toLocaleString("fa-IR")} < ۱۰۰٬۰۰۰ — سناریوی تسویه رد شد`)
  }

  // ═══════════ AUTH-011: بازپخش اعتبار تمدید ═══════════
  console.log("\n🔄 AUTH-011 — چرخش و بازپخش اعتبار تمدید…")
  const rtCookie = user.raw.find((c) => c.startsWith("hk_rt="))
  const first = await fetch(BASE + "/api/v1/auth/refresh", { method: "POST", headers: { Cookie: rtCookie } })
  assert(first.status === 200, "تمدید اول موفق شد و جانشین جدید ساخته شد")
  const newRt = first.headers.get("set-cookie")?.match(/hk_rt=([^;]+)/)?.[1]
  assert(!!newRt && newRt !== rtCookie.split("=")[1], "توکن جانشین متفاوت از توکن مصرف‌شده است")

  // بازپخش تازه (زودتر از مهلت ۳۰ ثانیه) = رقابت سالم تب‌ها → فقط همین درخواست رد می‌شود
  const freshReplay = await fetch(BASE + "/api/v1/auth/refresh", { method: "POST", headers: { Cookie: rtCookie } })
  assert(freshReplay.status === 401, "بازپخش تازه رد شد (401) — بدون ابطال خانواده (رقابت سالم تب‌ها)")
  const survivor = await fetch(BASE + "/api/v1/auth/refresh", { method: "POST", headers: { Cookie: `hk_rt=${newRt}` } })
  assert(survivor.status === 200, "جانشین سالم همچنان کار می‌کند (تجربهٔ چند‌تبی حفظ شد)")
  const newRt2 = survivor.headers.get("set-cookie")?.match(/hk_rt=([^;]+)/)?.[1]

  // بازپخش کهنه (بیش از ۳۰ ثانیه پس از چرخش) = سوءاستفاده → ابطال کل خانواده
  console.log("  … انتظار ۳۲ ثانیه برای عبور از پنجرهٔ مهلت…")
  await new Promise((r) => setTimeout(r, 32000))
  const staleReplay = await fetch(BASE + "/api/v1/auth/refresh", { method: "POST", headers: { Cookie: rtCookie } })
  assert(staleReplay.status === 401, "بازپخش کهنه رد شد (401)")
  const familyDead = await fetch(BASE + "/api/v1/auth/refresh", { method: "POST", headers: { Cookie: `hk_rt=${newRt2}` } })
  assert(familyDead.status === 401, "کل خانوادهٔ نشست‌های کاربر باطل شد — سرقت توکن متوقف شد (AUTH-011)")

  // ═══════════ پارامتریک‌سازی OPEN-01..18 ═══════════
  console.log("\n⚙️ تنظیمات پارامتریک OPEN-01..18 در پنل ادمین…")
  const settings = (await call("GET", "/api/v1/admin/settings", null, admin.cookie)).json.data
  const openKeys = settings.settings.filter((s) => /OPEN-\d+/.test(s.title))
  assert(openKeys.length >= 15, `تنظیم‌های پارامتریک OPEN قابل ویرایش: ${openKeys.length} مورد`)
  const groups = new Set(settings.settings.map((s) => s.group))
  assert(groups.size >= 3, `گروه‌بندی فعال: ${[...groups].join(" · ")}`)

  const setPlan = await call("PUT", "/api/v1/admin/settings", { key: "DISCOUNT_PRECEDENCE", value: "PLAN" }, admin.cookie)
  assert(setPlan.json?.ok, "تغییر تقدم تخفیف به PLAN ذخیره شد (OPEN-02)")
  const badVal = await call("PUT", "/api/v1/admin/settings", { key: "DISCOUNT_PRECEDENCE", value: "WHATEVER" }, admin.cookie)
  assert(badVal.status === 422, "مقدار خارج از لیست مجاز رد شد (اعتبارسنجی شمارشی)")
  const setBack = await call("PUT", "/api/v1/admin/settings", { key: "DISCOUNT_PRECEDENCE", value: "DOCTOR" }, admin.cookie)
  assert(setBack.json?.ok, "بازگردانی به DOCTOR انجام شد")

  console.log("\n🏁 همهٔ آزمون‌های سطوح کاربری و اینوارینت‌ها موفق بودند.")
}

main().catch((e) => {
  console.error("✗", e.message)
  process.exit(1)
})
