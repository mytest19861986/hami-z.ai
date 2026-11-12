// ─────────────────────────────────────────────────────────────────────────────
// تست E2E دکمه «عملیات» در بخش نمایندگان فروش ادمین:
//   ۱) ورود ادمین  ۲) لیست نمایندگان (firstName/lastName جدید)
//   ۳) آمار عملکرد فروش در بازه (stats)  ۴) ویرایش اطلاعات (update_profile)
//   ۵) رد/تعلیق با دلیل (فقط روی رکورد ساختگی تست می‌شود و برمی‌گردد)
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:3000"
const ADMIN_MOBILE = "09120000000"
const ADMIN_PASSWORD = "Hami@Admin123"

const jar = new Map()
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) }
function cookieHeader() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") }
function absorbCookies(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []
  for (const c of list) {
    const pair = c.split(";")[0]
    const i = pair.indexOf("=")
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1).trim())
  }
}
async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(), ...(init.headers ?? {}) },
  })
  absorbCookies(res)
  let body = null
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}
const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1) } log("PASS: " + msg) }

async function main() {
  // ۱) ورود ادمین
  const login = await call("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ mobile: ADMIN_MOBILE, password: ADMIN_PASSWORD }) })
  assert(login.body?.ok, "admin login ok")
  const me = await call("/api/v1/auth/me")
  assert(me.body?.data?.id, "session ok")

  // ۲) لیست نمایندگان — firstName/lastName جدید
  const list = await call("/api/v1/admin/agents?page=1")
  assert(list.body?.ok, "agents list ok — total=" + list.body?.data?.total)
  const agent = list.body?.data?.agents?.[0]
  assert(agent, "first agent exists: " + agent?.name + " (" + agent?.status + ")")
  assert("firstName" in agent && "lastName" in agent, "firstName/lastName present in list: " + JSON.stringify({ f: agent.firstName, l: agent.lastName }))

  // ۳) آمار عملکرد فروش — بازهٔ وسیع (کل تاریخ داده‌ها)
  const from = "2026-01-01"
  const to = "2026-12-31"
  const stats = await call(`/api/v1/admin/agents/stats?agentId=${agent.id}&from=${from}&to=${to}`)
  assert(stats.body?.ok, "stats endpoint ok")
  const t = stats.body?.data?.totals
  log("STATS: " + JSON.stringify(t))
  log("STATS agent: " + JSON.stringify(stats.body?.data?.agent))
  log("commissions in range: " + stats.body?.data?.commissions?.length + " | settlements in range: " + stats.body?.data?.settlements?.length)
  assert(t && typeof t.customers === "number" && typeof t.commissionTotal === "number", "totals shape ok")
  assert(Array.isArray(stats.body?.data?.commissions) && Array.isArray(stats.body?.data?.settlements), "records arrays ok")
  if (stats.body?.data?.commissions?.[0]) log("sample commission: " + JSON.stringify(stats.body.data.commissions[0]))
  if (stats.body?.data?.settlements?.[0]) log("sample settlement: " + JSON.stringify(stats.body.data.settlements[0]))

  // بازهٔ نامعتبر باید خطا بدهد
  const bad = await call(`/api/v1/admin/agents/stats?agentId=${agent.id}&from=2026-05-10&to=2026-05-01`)
  assert(bad.status === 422, "invalid range rejected (422)")

  // ۴) ویرایش اطلاعات — تغییر توضیحات و بازگردانی
  const before = { phone: agent.phone, description: agent.description, city: agent.city }
  const upd = await call("/api/v1/admin/agents", {
    method: "POST",
    body: JSON.stringify({
      action: "update_profile", agentId: agent.id,
      firstName: "باهار", lastName: "اصلانی",
      businessName: agent.businessName ?? "نمایندگی تست",
      description: "تست ویرایش از دکمه عملیات", phone: "021-12345678",
      province: agent.province ?? "تهران", city: agent.city ?? "تهران",
    }),
  })
  assert(upd.body?.ok, "update_profile ok")
  const list2 = await call("/api/v1/admin/agents?page=1")
  const agent2 = list2.body?.data?.agents?.find((a) => a.id === agent.id)
  assert(agent2?.description === "تست ویرایش از دکمه عملیات" && agent2?.phone === "021-12345678", "edit persisted (description+phone)")
  assert(agent2?.name === "باهار اصلانی", "profile name updated: " + agent2?.name)

  // استان/شهر نامعتبر باید رد شود
  const badGeo = await call("/api/v1/admin/agents", {
    method: "POST",
    body: JSON.stringify({ action: "update_profile", agentId: agent.id, province: "تهران", city: "شهر_ناموجود" }),
  })
  assert(badGeo.status === 422, "invalid province/city rejected (422)")

  // بازگرداندن مقادیر قبلی
  const revert = await call("/api/v1/admin/agents", {
    method: "POST",
    body: JSON.stringify({
      action: "update_profile", agentId: agent.id,
      description: before.description ?? "", phone: before.phone ?? "",
      province: agent.province, city: before.city,
    }),
  })
  assert(revert.body?.ok, "revert ok")

  // ۵) تأیید می‌کنیم رد بدون دلیل رد می‌شود (بدون تغییر وضعیت واقعی)
  const noReason = await call("/api/v1/admin/agents", {
    method: "POST",
    body: JSON.stringify({ action: "review_agent", agentId: agent.id, decision: "REJECT", reason: "" }),
  })
  assert(noReason.status === 422, "reject without reason rejected (422)")

  log("ALL CHECKS PASSED")
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1) })
