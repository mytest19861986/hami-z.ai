// بررسی رندر صفحه خرید پس از حذف بخش «دارنده طرح»
const BASE = "http://localhost:3000"
const jar = new Map()
function absorb(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []
  for (const c of list) {
    const pair = c.split(";")[0]
    const i = pair.indexOf("=")
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
}
const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")

const r1 = await fetch(BASE + "/api/v1/auth/send-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mobile: "09120000001" }),
})
absorb(r1)
const code = (await r1.json()).data.devCode
const r2 = await fetch(BASE + "/api/v1/auth/verify-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie() },
  body: JSON.stringify({ mobile: "09120000001", code: String(code) }),
})
absorb(r2)
const login = await r2.json()
if (!login.ok) throw new Error("login failed: " + JSON.stringify(login))

const page = await fetch(BASE + "/user/buy", { headers: { Cookie: cookie() } })
const html = await page.text()
console.log("GET /user/buy →", page.status)

const mustAbsent = ["ثبت دارنده جدید", "انتخاب دارنده از فهرست", "عضو خانواده", "۳. معرف", "اشخاص متفاوتی"]
const mustPresent = ["۱. انتخاب طرح", "۲. معرف (کد رفرال)", "خرید طرح فقط به نام خود شما ثبت می‌شود", "دارنده طرح", "کاربر نمونه"]

let fail = false
console.log("\n— نباید وجود داشته باشد —")
for (const t of mustAbsent) {
  const n = html.split(t).length - 1
  console.log(`${n === 0 ? "✓" : "✗"} (${n}) ${t}`)
  if (n > 0) fail = true
}
console.log("\n— باید وجود داشته باشد —")
for (const t of mustPresent) {
  const n = html.split(t).length - 1
  console.log(`${n > 0 ? "✓" : "✗"} (${n}) ${t}`)
  if (n === 0) fail = true
}

process.exit(fail ? 1 : 0)
