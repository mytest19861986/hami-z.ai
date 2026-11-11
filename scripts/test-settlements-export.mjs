// ─────────────────────────────────────────────────────────────────────────────
// تست سرتاسری خروجی تسویه‌های تأییدشده (EXPORT-SETTLE):
// ورود ادمین → گرفتن لیست تسویه‌ها → خروجی اکسل (ذخیره فایل) → صفحه چاپ/PDF
// → بررسی عدم دسترسی بدون نشست → گزارش نتیجه
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs"

const BASE = "http://localhost:3000"
const ADMIN_MOBILE = "09120000000"
const ADMIN_PASSWORD = "Hami@Admin123"
const OUT_DIR = "/home/z/my-project/download"

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

async function main() {
  // ۱) ورود ادمین
  const login = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: ADMIN_MOBILE, password: ADMIN_PASSWORD }),
  })
  absorbCookies(login)
  const loginBody = await login.json().catch(() => null)
  if (!loginBody?.ok) throw new Error("admin login failed: " + JSON.stringify(loginBody))
  log("ADMIN_LOGIN ok")

  // ۲) لیست تسویه‌های تأییدشده
  const listRes = await fetch(BASE + "/api/v1/admin/settlements?status=APPROVED", {
    headers: { Cookie: cookieHeader() },
  })
  absorbCookies(listRes)
  const list = await listRes.json()
  const approved = list?.data?.settlements ?? []
  log(`APPROVED_LIST count=${approved.length}`)
  if (approved.length === 0) throw new Error("هیچ تسویهٔ تأییدشده‌ای برای تست نیست!")
  for (const s of approved) log(`  - ${s.trackingCode} | ${s.applicant} | ${s.amount} | card=${s.bankCardNumber} | sheba=${s.bankSheba}`)
  const ids = approved.map((s) => s.id)

  // ۳) خروجی اکسل
  const xRes = await fetch(BASE + "/api/v1/admin/settlements/export", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookieHeader() },
    body: JSON.stringify({ ids }),
  })
  absorbCookies(xRes)
  log(`EXPORT status=${xRes.status} type=${xRes.headers.get("content-type")} count=${xRes.headers.get("x-export-count")} total=${xRes.headers.get("x-export-total")} cd=${xRes.headers.get("content-disposition")}`)
  if (!xRes.ok) {
    const t = await xRes.text()
    throw new Error("export failed: " + t.slice(0, 300))
  }
  const xbuf = Buffer.from(await xRes.arrayBuffer())
  const fname = /filename="([^"]+)"/.exec(xRes.headers.get("content-disposition") ?? "")?.[1] ?? "settlements.xlsx"
  writeFileSync(`${OUT_DIR}/${fname}`, xbuf)
  log(`XLSX_SAVED ${OUT_DIR}/${fname} (${xbuf.length} bytes)`)

  // ۳-ب) خروجی با شناسهٔ نامعتبر (mix approved + pending) — باید فقط تأییدشده‌ها بیاید
  const listAll = await (await fetch(BASE + "/api/v1/admin/settlements", { headers: { Cookie: cookieHeader() } })).json()
  const nonApproved = (listAll?.data?.settlements ?? []).find((s) => s.status !== "APPROVED")
  if (nonApproved) {
    const mRes = await fetch(BASE + "/api/v1/admin/settlements/export", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookieHeader() },
      body: JSON.stringify({ ids: [...ids, nonApproved.id] }),
    })
    log(`MIXED_EXPORT status=${mRes.status} count=${mRes.headers.get("x-export-count")} (انتظار: ${ids.length})`)
    if (mRes.headers.get("x-export-count") !== String(ids.length)) throw new Error("فیلتر سمت سرور فقط-تأییدشده کار نکرد!")
  }

  // ۴) صفحه چاپ/PDF با نشست ادمین
  const pRes = await fetch(`${BASE}/print/settlements?ids=${encodeURIComponent(ids.join(","))}`, {
    headers: { Cookie: cookieHeader() },
  })
  absorbCookies(pRes)
  const html = await pRes.text()
  log(`PRINT_PAGE status=${pRes.status} len=${html.length}`)
  const checks = {
    applicant: html.includes(approved[0].applicant),
    card: html.includes(approved[0].bankCardNumber),
    sheba: html.includes(approved[0].bankSheba),
    title: html.includes("فهرست تسویه‌های تأییدشده برای پرداخت"),
    brand: html.includes("حامی‌کارت"),
    total: html.includes("جمع کل"),
  }
  log("PRINT_CHECKS " + JSON.stringify(checks))
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)
  if (failed.length) throw new Error("صفحه چاپ این موارد را ندارد: " + failed.join(", "))
  writeFileSync(`${OUT_DIR}/settlements-print-preview.html`, html)
  log("PRINT_HTML_SAVED for visual check")

  // ۵) صفحه چاپ بدون نشست — نباید داده بدهد
  const noAuth = await fetch(`${BASE}/print/settlements?ids=${encodeURIComponent(ids.join(","))}`)
  const noAuthHtml = await noAuth.text()
  const leaked = approved[0].bankCardNumber && noAuthHtml.includes(approved[0].bankCardNumber)
  const denied = noAuthHtml.includes("ورود") || noAuth.status === 200 // پیام دسترسی
  log(`NO_AUTH status=${noAuth.status} deniedMsg=${denied} leakedCard=${leaked}`)
  if (leaked) throw new Error("نشت داده بدون نشست در صفحه چاپ!")

  // ۶) خروجی بدون انتخاب — خطای اعتبارسنجی
  const emptyRes = await fetch(BASE + "/api/v1/admin/settlements/export", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookieHeader() },
    body: JSON.stringify({ ids: [] }),
  })
  const emptyBody = await emptyRes.json().catch(() => null)
  log(`EMPTY_EXPORT status=${emptyRes.status} err=${emptyBody?.error ?? "-"}`)
  if (emptyRes.status !== 422) throw new Error("اعتبارسنجی آرایهٔ خالی کار نکرد!")

  // ۷) خروجی بدون مجوز (کاربر عادی)
  const uLogin = await fetch(BASE + "/api/v1/auth/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: "09120000001" }),
  })
  const devCode = (await uLogin.json())?.data?.devCode
  if (devCode) {
    const vRes = await fetch(BASE + "/api/v1/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: "09120000001", code: String(devCode) }),
    })
    absorbCookies(vRes)
    const forbidden = await fetch(BASE + "/api/v1/admin/settlements/export", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookieHeader() },
      body: JSON.stringify({ ids }),
    })
    log(`USER_EXPORT status=${forbidden.status} (انتظار: 403)`)
    if (forbidden.status !== 403) throw new Error("کاربر بدون مجوز توانست خروجی بگیرد!")
  } else {
    log("USER_EXPORT skipped (devCode unavailable)")
  }

  log("ALL_EXPORT_TESTS_PASSED")
}

main().catch((e) => {
  console.error("TEST_FAILED:", e.message)
  process.exit(1)
})
