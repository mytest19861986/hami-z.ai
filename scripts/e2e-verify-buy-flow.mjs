// ─────────────────────────────────────────────────────────────────────────────
// تست سرتاسری جریان خرید (E2E) — نسخهٔ «خرید فقط به نام خود کاربر»:
// ورود کاربر → درخواست خرید طرح (بدون دارنده) → (واچر ادمین تأیید می‌کند)
// → بررسی SUCCESS + عضویت فعال به نام خود کاربر + اطلاع‌رسانی
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:3000"
const USER_MOBILE = process.env.E2E_USER ?? "09120000001" // کاربر نمونه
const PLAN_ID = process.env.E2E_PLAN ?? "cmw9gkh3d003xndma3jxucos3" // طرح برنزی

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

  // پروفایل (برای نمایش نام دارنده در نتیجه)
  const rp = await call("/api/v1/user/profile")
  const prof = rp.body?.data?.profile
  log(`PROFILE firstName=${prof?.firstName} lastName=${prof?.lastName} nc=${prof?.nationalCode}`)

  // ۲) ثبت درخواست خرید — فقط planId، بدون دارنده (خرید به نام خود کاربر)
  const r4 = await call("/api/v1/user/purchases", {
    method: "POST",
    body: JSON.stringify({ planId: PLAN_ID }),
  })
  log("PURCHASE_CREATE resp: " + JSON.stringify(r4.body))
  if (!r4.body?.ok) throw new Error("purchase failed")
  const tracking = r4.body.data.purchase.trackingCode

  // ۳) صبر برای تأیید خودکار توسط واچر (تا ۴۰ ثانیه)
  let final = null
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const r5 = await call("/api/v1/user/purchases")
    const p = (r5.body?.data ?? []).find((x) => x.trackingCode === tracking)
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
  log(`FINAL status=${final.status} tracking=${final.trackingCode} holder="${final.holder}" approvedAt=${final.approvedAt ?? "-"}`)

  // ۴) بررسی عضویت‌ها (باید به نام خود کاربر باشد)
  const r6 = await call("/api/v1/user/memberships")
  const ms = r6.body?.data ?? []
  log("MEMBERSHIPS (newest 3):")
  for (const m of ms.slice(0, 3)) {
    log(`  plan="${m.planTitle}" holder="${m.holder}" status=${m.status} origin=${m.originType}`)
  }

  // ۵) اعلان‌های کاربر
  const r7 = await call("/api/v1/user/notifications")
  const notes = (r7.body?.data?.items ?? []).slice(0, 3)
  log("NOTIFICATIONS (top 3):")
  for (const n of notes) log(`  ${n.title}`)
}

main().catch((e) => {
  console.error("E2E_FAILED:", e.message)
  process.exit(1)
})
