const BASE = "http://localhost:3000"
async function call(m, p, b, c) {
  const r = await fetch(BASE + p, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b ? JSON.stringify(b) : undefined })
  const j = await r.json().catch(() => null)
  return { status: r.status, json: j }
}
const s = await call("POST", "/api/v1/auth/send-otp", { mobile: "09120000002" })
const code = s.json.data.devCode
const v = await fetch(BASE + "/api/v1/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile: "09120000002", code }) })
const cookie = v.headers.get("set-cookie").split(/,(?=[^;]+?=)/).map((c) => c.split(";")[0].trim()).join("; ")
const prof = await call("GET", "/api/v1/user/profile", null, cookie)
console.log("PROFILE:", JSON.stringify(prof.json.data?.profile?.cardNumber), prof.json.data?.profile?.sheba)
const r = await call("POST", "/api/v1/agent/settlements", { amount: 180000 }, cookie)
console.log("SETTLE:", r.status, JSON.stringify(r.json))
