// تست یکپارچگی زنجیره مالی حامی‌کارت (اجرای مستقیم روی API)
const BASE = "http://localhost:3000"

async function call(method, path, body, cookie) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  const setCookie = res.headers.get("set-cookie")
  return { status: res.status, json, setCookie }
}

function extractCookies(setCookie) {
  if (!setCookie) return null
  const parts = setCookie.split(/,(?=[^;]+?=)/).map((c) => c.split(";")[0].trim())
  return parts.join("; ")
}

async function login(mobile) {
  const send = await call("POST", "/api/v1/auth/send-otp", { mobile })
  const devCode = send.json?.data?.devCode
  if (!devCode) throw new Error(`OTP fail for ${mobile}: ${JSON.stringify(send.json)}`)
  const verify = await call("POST", "/api/v1/auth/verify-otp", { mobile, code: devCode })
  if (!verify.json?.ok) throw new Error(`verify fail: ${JSON.stringify(verify.json)}`)
  return extractCookies(verify.setCookie)
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
  console.log(`  ✓ ${msg}`)
}

async function main() {
  console.log("🔑 ورود نقش‌ها…")
  const admin = await login("09120000000") // SUPER_ADMIN
  const agent = await login("09120000002") // نماینده تأییدشده
  assert(!!admin && !!agent, "ورود مدیر و نماینده")

  // ۱) نماینده: ثبت مشتری
  console.log("\n👤 ثبت مشتری توسط نماینده…")
  const plans = (await call("GET", "/api/v1/public/plans", null, agent).then((r) => r.json.data))
  const plan = plans.find((p) => p.title.includes("طلایی"))
  // تولید کد ملی معتبر
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
  const validCode = fixCode("223456789")
  assert(!!validCode, `کد ملی معتبر تولید شد: ${validCode}`)
  const cust = await call("POST", "/api/v1/agent/customers", {
    firstName: "مریم", lastName: "احمدی‌نژاد", nationalCode: validCode, mobile: "09120000088",
    planId: plan.id, address: "تهران، خیابان آزادی، پلاک ۱۲", postalCode: "1234567890",
  }, agent)
  assert(cust.json?.ok, "ثبت مشتری توسط نماینده")
  const saleId = cust.json.data.saleId

  // ثبت تکراری همان طرح/مشتری باید رد شود
  const dup = await call("POST", "/api/v1/agent/customers", {
    firstName: "مریم", lastName: "احمدی‌نژاد", nationalCode: validCode, mobile: "",
    planId: plan.id, address: "تکراری",
  }, agent)
  assert(dup.status === 409, "ثبت تکراری پرونده باز رد شد (SALE)")

  // ۲) مدیر: چرخه وضعیت فروش تا نهایی‌شدن
  console.log("\n🛒 چرخه فروش تا نهایی‌شدن…")
  const steps = [
    { action: "transition", to: "APPROVED" },
    { action: "transition", to: "CARD_ISSUED", cardNumber: "HK-2026-0001" },
    { action: "transition", to: "SENT" },
    { action: "transition", to: "DELIVERED" },
  ]
  for (const s of steps) {
    const r = await call("POST", "/api/v1/admin/sales", { saleId, ...s }, admin)
    assert(r.json?.ok, `گذار ${s.to}`)
  }
  // پرش غیرمجاز: نهایی‌کردن قبل از ثبت پرداخت باید رد شود
  const badJump = await call("POST", "/api/v1/admin/sales", { action: "transition", saleId, to: "FINALIZED" }, admin)
  assert(badJump.status === 409, "نهایی‌کردن بدون ثبت پرداخت رد شد (SALE-005)")

  const pay = await call("POST", "/api/v1/admin/sales", { action: "register_payment", saleId, amount: 1200000, paymentTrackingCode: "PAY-777" }, admin)
  assert(pay.json?.ok, "ثبت پرداخت فروش")
  const fin = await call("POST", "/api/v1/admin/sales", { action: "transition", saleId, to: "FINALIZED" }, admin)
  assert(fin.json?.ok && fin.json.data.membershipId, "نهایی‌کردن فروش → عضویت + پورسانت")

  // ۳) پورسانت فروش نماینده
  console.log("\n💰 پورسانت فروش…")
  const walletBefore = (await call("GET", "/api/v1/agent/wallet", null, agent)).json.data
  const commissions = (await call("GET", "/api/v1/agent/commissions", null, agent)).json.data
  const saleCommission = commissions.items.find((c) => c.type === "SALE" && c.status === "PENDING")
  assert(!!saleCommission, "پورسانت فروش PENDING ایجاد شد")
  assert(saleCommission.amount === Math.round((1200000 * 15) / 100), `مبلغ پورسانت درست است (${saleCommission.amount} = ۱۵٪ × ۱٬۲۰۰٬۰۰۰)`)

  // تأیید دوباره همان پورسانت باید رد شود (idempotency)
  const approve = await call("POST", "/api/v1/admin/commissions", { commissionId: saleCommission.id, decision: "APPROVE" }, admin)
  assert(approve.json?.ok, "تأیید پورسانت توسط مدیر")
  const approveTwice = await call("POST", "/api/v1/admin/commissions", { commissionId: saleCommission.id, decision: "APPROVE" }, admin)
  assert(approveTwice.status === 409, "تأیید تکراری پورسانت رد شد (REF-009)")

  const wallet = (await call("GET", "/api/v1/agent/wallet", null, agent)).json.data
  assert(
    wallet.withdrawableBalance === walletBefore.withdrawableBalance + 180000,
    `تأیید پورسانت دقیقاً ۱۸۰٬۰۰۰ به مانده افزود (${walletBefore.withdrawableBalance} → ${wallet.withdrawableBalance})`
  )

  // ۴) تسویه
  console.log("\n🏦 تسویه…")
  const tooMuch = await call("POST", "/api/v1/agent/settlements", { amount: 999999 }, agent)
  assert(tooMuch.status === 409, "درخواست بیشتر از مانده رد شد (SETTLE-004)")

  // پاک‌سازی اطلاعات بانکی (مقاوم به ترتیب اجرای سوئیت‌ها) + لغو درخواست باز احتمالی
  await call("PUT", "/api/v1/user/profile", { cardNumber: "", sheba: "", bankAccountName: "" }, agent)
  for (const s of ((await call("GET", "/api/v1/agent/settlements", null, agent)).json.data ?? []).filter((x) => x.status === "PENDING")) {
    await call("DELETE", "/api/v1/agent/settlements", { id: s.id }, agent)
  }
  const noBank = await call("POST", "/api/v1/agent/settlements", { amount: 180000 }, agent)
  assert(noBank.status === 409 && noBank.json.error.includes("صاحب حساب"), `درخواست بدون اطلاعات بانکی رد شد (SETTLE-002): «${noBank.json.error.slice(0, 40)}…»`)

  // تولید کارت معتبر Luhn و شبا معتبر
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
  let card = null
  for (let c = 0; c <= 9 && !card; c++) {
    const cand = "621986101234567" + c
    if (luhnValid(cand)) card = cand
  }
  function shebaValid(s) {
    const r = s.slice(2) + "1827"
    let rem = 0
    for (const ch of r) rem = (rem * 10 + parseInt(ch)) % 97
    return rem === 1
  }
  let sheba = null
  for (let n = 0; n < 1000 && !sheba; n++) {
    const body = ("0170000000" + String(n)).padEnd(24, "0").slice(0, 24)
    const cand = "IR" + body
    if (shebaValid(cand)) sheba = cand
  }
  assert(!!card && !!sheba, `کارت/شبای معتبر تولید شد (${card} / ${sheba.slice(0, 6)}…)`)

  const profileRes = await call("PUT", "/api/v1/user/profile", { cardNumber: card, sheba, bankAccountName: "نماینده نمونه" }, agent)
  assert(profileRes.json?.ok, "ثبت اطلاعات بانکی در پروفایل")
  const badProfile = await call("PUT", "/api/v1/user/profile", { cardNumber: "1111111111111111" }, agent)
  assert(badProfile.status === 422, "کارت نامعتبر Luhn رد شد (PROFILE-008)")

  const minFail = await call("POST", "/api/v1/agent/settlements", { amount: 50000 }, agent)
  assert(minFail.status === 409, "کمتر از حداقل مبلغ تسویه رد شد (SETTLE-004)")

  // مبلغ تسویه = کل مانده فعلی (مقاوم به ترتیب اجرای سوئیت‌ها)
  const walletPre = (await call("GET", "/api/v1/agent/wallet", null, agent)).json.data
  const settleAmount = walletPre.withdrawableBalance
  assert(settleAmount >= 100000, `مانده برای تسویه کافی است (${settleAmount.toLocaleString("fa-IR")})`)
  const settle = await call("POST", "/api/v1/agent/settlements", { amount: settleAmount }, agent)
  assert(settle.json?.ok, "درخواست تسویه ثبت و مبلغ نگه‌داشته شد")
  const settleDup = await call("POST", "/api/v1/agent/settlements", { amount: 100000 }, agent)
  assert(settleDup.status === 409, "درخواست دوم هم‌زمان رد شد (SETTLE-005 · AC-12)")

  const walletAfter = (await call("GET", "/api/v1/agent/wallet", null, agent)).json.data
  assert(
    walletAfter.withdrawableBalance === 0 && walletAfter.heldBalance === walletPre.heldBalance + settleAmount,
    `مانده صحیح به نگهداشت منتقل شد (wd=0، held=${walletAfter.heldBalance})`
  )

  const settlementId = settle.json.data.settlementId
  const review = await call("POST", "/api/v1/admin/settlements", { action: "review", settlementId, decision: "APPROVE" }, admin)
  assert(review.json?.ok, "تأیید درخواست تسویه")
  const paid = await call("POST", "/api/v1/admin/settlements", { action: "mark_paid", settlementId, paymentTrackingCode: "TRF-999" }, admin)
  assert(paid.json?.ok, "ثبت پرداخت تسویه (SUPER_ADMIN)")

  const walletFinal = (await call("GET", "/api/v1/agent/wallet", null, agent)).json.data
  assert(walletFinal.withdrawableBalance === 0 && walletFinal.heldBalance === 0, "پس از تسویه، مانده‌ها صفر شد")

  const commissionsFinal = (await call("GET", "/api/v1/agent/commissions", null, agent)).json.data
  const paidCommission = commissionsFinal.items.find((c) => c.type === "SALE")
  assert(paidCommission.status === "PAID", "پورسانت به حالت پرداخت‌شده رفت (FIFO · REF-007)")

  // ۵) مرجوعی پس از تسویه باید بلوکه شود (COMMISSION_ALREADY_PAID)
  const ret = await call("POST", "/api/v1/admin/sales", { action: "return", saleId, reason: "تست مرجوعی پس از تسویه" }, admin)
  assert(ret.status === 409 && String(ret.json.error).includes("مدیر ارشد"), "مرجوعی پس از تسویه پورسانت بلوکه شد (OPEN-07)")

  console.log("\n🏁 همه آزمون‌های زنجیره مالی با موفقیت انجام شد.")
}

main().catch((e) => {
  console.error("✗", e.message)
  process.exit(1)
})
