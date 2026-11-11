// ─────────────────────────────────────────────────────────────────────────────
// تأییدکنندهٔ آزمایشی پرداخت (TEST-PAY-APPROVER)
// کاربرد: تا وقتی این اسکریپت روشن است، هر درخواست خرید طرح (PENDING) که
// کاربرها ثبت کنند، ظرف چند ثانیه از طریق «همان API داشبورد ادمین» تأیید می‌شود
// تا بتوان کل جریان (ثبت درخواست ← تأیید مدیر ← فعال شدن طرح) را تست کرد.
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:3000"
const ADMIN_MOBILE = "09120000000" // SUPER_ADMIN بذر (seed)
const DURATION_MS = 30 * 60 * 1000 // پنجرهٔ ۳۰ دقیقه‌ای
const POLL_MS = 4000
const NOTE = "تأیید آزمایشی پرداخت — تست جریان خرید (درگاه متصل نیست)"

const jar = new Map<string, string>()
const handled = new Set<string>()
const t0 = Date.now()

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function cookieHeader(): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
}

function absorbCookies(res: Response) {
  const anyRes = res as unknown as { getSetCookie?: () => string[] }
  const list = typeof anyRes.getSetCookie === "function" ? anyRes.getSetCookie() : []
  for (const c of list) {
    const pair = c.split(";")[0]
    const idx = pair.indexOf("=")
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
  }
}

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(), ...(init.headers ?? {}) },
  })
  absorbCookies(res)
  let body: any = null
  try {
    body = await res.json()
  } catch {}
  return { status: res.status, body }
}

async function adminLogin(): Promise<void> {
  jar.clear()
  const r1 = await call("/api/v1/auth/send-otp", { method: "POST", body: JSON.stringify({ mobile: ADMIN_MOBILE }) })
  const code = r1.body?.data?.devCode
  if (!code) throw new Error("devCode missing: " + JSON.stringify(r1.body))
  const r2 = await call("/api/v1/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ mobile: ADMIN_MOBILE, code: String(code) }),
  })
  if (!r2.body?.ok) throw new Error("admin login failed: " + JSON.stringify(r2.body))
  log("ADMIN_LOGIN ok")
}

async function poll(): Promise<void> {
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
  const list: any[] = r.body.data?.purchases ?? []
  for (const p of list) {
    if (handled.has(p.id)) continue
    const ra = await call("/api/v1/admin/purchases", {
      method: "POST",
      body: JSON.stringify({ action: "approve", purchaseId: p.id, note: NOTE }),
    })
    if (ra.body?.ok) {
      handled.add(p.id)
      log(`APPROVED tracking=${p.trackingCode} plan="${p.planTitle}" buyer=${p.buyerMobile} holder="${p.holder}" amount=${p.amount}`)
    } else {
      // 409 = قبلاً تعیین تکلیف شده؛ خطای دیگر را هم یک‌بار امتحان می‌کنیم و رد می‌شویم
      handled.add(p.id)
      log(`APPROVE_FAILED tracking=${p.trackingCode} status=${ra.status} resp=${JSON.stringify(ra.body)}`)
    }
  }
}

async function main() {
  log(`watcher started — window=${DURATION_MS / 60000}min poll=${POLL_MS}ms`)
  await adminLogin()
  while (Date.now() - t0 < DURATION_MS) {
    try {
      await poll()
    } catch (e: any) {
      log("POLL_EXCEPTION " + (e?.message ?? e))
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
  log("watcher finished (window expired)")
}

main()
