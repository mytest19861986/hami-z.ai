// ─────────────────────────────────────────────────────────────────────────────
// تأییدکنندهٔ آزمایشی پرداخت (TEST-PAY-APPROVER)
// تا وقتی این اسکریپت روشن است، هر درخواست خرید طرح (PENDING) که ثبت شود،
// ظرف چند ثانیه از طریق «همان API داشبورد ادمین» تأیید می‌شود تا کل جریان
// (ثبت درخواست ← تأیید مدیر ← فعال شدن طرح و کارت) قابل تست باشد.
// اجرا: node scripts/auto-approve-test-payments.mjs
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:3000"
const ADMIN_MOBILE = "09120000000" // SUPER_ADMIN از seed
const ADMIN_PASSWORD = "Hami@Admin123"
const DURATION_MS = 30 * 60 * 1000 // پنجرهٔ ۳۰ دقیقه‌ای
const POLL_MS = 4000
const NOTE = "تأیید آزمایشی پرداخت — تست جریان خرید (درگاه متصل نیست)"

const jar = new Map()
const handled = new Set()
const t0 = Date.now()

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

async function adminLogin() {
  jar.clear()
  const r = await call("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ mobile: ADMIN_MOBILE, password: ADMIN_PASSWORD }),
  })
  if (!r.body?.ok) throw new Error("admin login failed: " + JSON.stringify(r.body))
  log("ADMIN_LOGIN ok")
}

async function poll() {
  const r = await call("/api/v1/admin/purchases?status=PENDING")
  if (r.status === 401) {
    log("401 → re-login")
    await adminLogin()
    return
  }
  if (!r.body?.ok) {
    log("poll error: " + JSON.stringify(r.body))
    return
  }
  const list = r.body.data?.purchases ?? []
  for (const p of list) {
    if (handled.has(p.id)) continue
    const ra = await call("/api/v1/admin/purchases", {
      method: "POST",
      body: JSON.stringify({ action: "approve", purchaseId: p.id, note: NOTE }),
    })
    handled.add(p.id)
    if (ra.body?.ok) {
      log(`APPROVED tracking=${p.trackingCode} plan="${p.planTitle}" buyer=${p.buyerMobile} holder="${p.holder}" amount=${p.amount}`)
    } else {
      log(`APPROVE_FAILED tracking=${p.trackingCode} status=${ra.status} resp=${JSON.stringify(ra.body)}`)
    }
  }
}

async function main() {
  log(`watcher started — window=${DURATION_MS / 60000}min poll=${POLL_MS}ms`)
  await adminLogin()
  // یک poll اولیه برای اطمینان از سلامت نشست
  await poll()
  while (Date.now() - t0 < DURATION_MS) {
    try {
      await poll()
    } catch (e) {
      log("POLL_EXCEPTION " + (e?.message ?? e))
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
  log("watcher finished (window expired)")
}

main()
