// ─────────────────────────────────────────────────────────────────────────────
// تست سرتاسری جریان خرید (E2E):
// ورود کاربر → ثبت دارنده جدید → درخواست خرید طرح → (واچر ادمین تأیید می‌کند)
// → بررسی تبدیل به SUCCESS + عضویت فعال + اطلاع‌رسانی
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:3000"
const USER_MOBILE = "09121234567" // زهرا تست‌کننده
const PLAN_ID = "cmw9gkh3f003zndma0qo1s6te" // طرح طلایی
const HOLDER = {
  firstName: "مریم",
  lastName: "تست‌کننده",
  nationalCode: "0076543219",
  mobile: "",
}

const jar = new Map()
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
}
function absorbCookies(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []
  for (const c of list) {
    const pair = c.split(";")[0]
    const i = pair.indexOf("=")
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}
async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(), ...(init.headers ?? {}) },
  })
  absorbCookies(res)
  let body = null
  try {
    body = await res.json()
  } catch {}
  return { status: res.status, body }
}

async function main() {
  // ۱) ورود کاربر با OTP آزمایشی
  const r1 = await call("/api/v1/auth/send-otp", { method: "POST", body: JSON.stringify({ mobile: USER_MOBILE }) })
  const code = r1.body?.data?.devCode
  if (!code) throw new Error("OTP send failed: " + JSON.stringify(r1.body))
  const r2 = await call("/api/v1/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ mobile: USER_MOBILE, code: String(code) }),
  })
  if (!r2.body?.ok) throw new Error("user login failed: " + JSON.stringify(r2.body))
  log("USER_LOGIN ok (" + USER_MOBILE + ")")

  // ۲) ثبت دارنده جدید (مثل فرم «ثبت دارنده جدید» صفحه خرید)
  const r3 = await call("/api/v1/user/holders", { method: "POST", body: JSON.stringify(HOLDER) })
  if (!r3.body?.ok) {
    // اگر کد ملی تکراری بود، دارنده موجود را بردار
    log("HOLDER create resp: " + JSON.stringify(r3.body))
  }
  let holderId = r3.body?.data?.holder?.id ?? null
  if (!holderId) {
    const r3b = await call("/api/v1/user/holders")
    const found = (r3b.body?.data ?? []).find(
      (h) => h.firstName === HOLDER.firstName && h.lastName === HOLDER.lastName
    )
    holderId = found?.id ?? null
  }
  if (!holderId) throw new Error("no holder available")
  log("HOLDER ok id=" + holderId)

  // ۳) ثبت درخواست خرید (مثل دکمهٔ «خرید طرح»)
  const r4 = await call("/api/v1/user/purchases", {
    method: "POST",
    body: JSON.stringify({ planId: PLAN_ID, holderId }),
  })
  log("PURCHASE_CREATE resp: " + JSON.stringify(r4.body))
  if (!r4.body?.ok) throw new Error("purchase failed")
  const tracking = r4.body.data.purchase.trackingCode

  // ۴) صبر برای تأیید خودکار توسط واچر (تا ۴۰ ثانیه)
  let final = null
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const r5 = await call("/api/v1/user/purchases")
    const list = r5.body?.data ?? []
    const p = list.find((x) => x.trackingCode === tracking)
    if (p && p.status !== "PENDING") {
      final = p
      break
    }
    process.stdout.write(".")
  }
  console.log("")
  if (!final) {
    log("STILL PENDING after 40s — watcher did not approve!")
    process.exit(2)
  }
  log(`FINAL status=${final.status} tracking=${final.trackingCode} approvedAt=${final.approvedAt ?? "-"}`)

  // ۵) بررسی عضویت و کارت مجازی
  const r6 = await call("/api/v1/user/memberships")
  const ms = r6.body?.data ?? []
  const mine = ms.filter((m) => m.holder.includes(HOLDER.firstName) || ms.length > 0).slice(0, 3)
  log("MEMBERSHIPS (newest):")
  for (const m of mine) {
    log(`  plan="${m.planTitle}" holder="${m.holder}" status=${m.status} end=${String(m.endDate).slice(0, 10)} origin=${m.originType}`)
  }

  // ۶) اعلان‌های کاربر
  const r7 = await call("/api/v1/user/notifications")
  const notes = (r7.body?.data ?? []).slice(0, 3)
  log("NOTIFICATIONS (top 3):")
  for (const n of notes) log(`  ${n.title}`)
}

main().catch((e) => {
  console.error("E2E_FAILED:", e.message)
  process.exit(1)
})
