#!/usr/bin/env node
// ============================================================================
// link-standalone-db.mjs — اتصال پوشهٔ db به خروجی standalone
// ============================================================================
// مشکل: سرور production از .next/standalone اجرا می‌شود (process.chdir به
// همان مسیر)؛ بدون این اسکریپت، آپلودهای کاربران (db/uploads) داخل
// standalone ذخیره می‌شوند و با هر «next build» بعدی پاک می‌شوند.
//
// راه‌حل: بعد از هر build، پوشهٔ db داخل standalone با یک symlink به
// پوشهٔ واقعی db در ریشهٔ پروژه جایگزین می‌شود تا هم دیتابیس و هم
// آپلودها همیشه از یک جای پایدار خوانده/نوشته شوند.
// ============================================================================
import { rmSync, symlinkSync, existsSync, mkdirSync, readdirSync, statSync, renameSync, cpSync, copyFileSync } from "fs"
import path from "path"

const root = process.cwd()
const standalone = path.join(root, ".next", "standalone")
const realDb = path.join(root, "db")
const linkedDb = path.join(standalone, "db")

if (!existsSync(standalone)) {
  console.error("✗ پوشهٔ .next/standalone پیدا نشد — ابتدا next build را اجرا کنید.")
  process.exit(1)
}
if (!existsSync(realDb)) {
  console.error("✗ پوشهٔ db در ریشهٔ پروژه پیدا نشد.")
  process.exit(1)
}

// اگر قبلاً symlink درست است، کاری نکن
try {
  if (existsSync(linkedDb) && statSync(linkedDb).isSymbolicLink()) {
    console.log("• symlink از قبل درست است — کاری لازم نیست.")
    process.exit(0)
  }
} catch {}

// اگر پوشهٔ db داخل standalone از build قبلی مانده، محتوایش را به db اصلی
// منتقل کنیم (فایل‌های آپلودی که ممکن است فقط آنجا باشند) و بعد حذفش کنیم.
if (existsSync(linkedDb)) {
  const uploadsSrc = path.join(linkedDb, "uploads")
  const uploadsDst = path.join(realDb, "uploads")
  if (existsSync(uploadsSrc)) {
    mkdirSync(uploadsDst, { recursive: true })
    for (const entry of readdirSync(uploadsSrc)) {
      const s = path.join(uploadsSrc, entry)
      const d = path.join(uploadsDst, entry)
      if (!existsSync(d)) {
        try {
          rmSync(d, { force: true })
        } catch {}
        try {
          // منتقل (rename)؛ اگر ممکن نبود کپی
          try {
            renameSync(s, d)
          } catch {
            cpSync(s, d, { recursive: true })
          }
          console.log(`  • بازگردانی ${entry} از standalone به db/uploads`)
        } catch (e) {
          console.warn(`  ⚠ انتقال ${entry} ناموفق: ${e.message}`)
        }
      }
    }
  }
  rmSync(linkedDb, { recursive: true, force: true })
}

// ساخت symlink: standalone/db → ../../db
symlinkSync(path.join("..", "..", "db"), linkedDb, "dir")
console.log("✓ symlink ساخته شد: .next/standalone/db → db (آپلودها و دیتابیس با rebuild پاک نمی‌شوند)")

// کپی تازهٔ .env به داخل standalone: مقادیر env (مثل SHOW_DEV_OTP یا تغییر مسیر
// DATABASE_URL روی سرور) باید در زمان build خوانده شوند؛ نسخهٔ کپی‌شده توسط
// next build ممکن است کهنه باشد، پس همیشه از ریشه تازه کپی می‌شود.
const envSrc = path.join(root, ".env")
const envDst = path.join(standalone, ".env")
if (existsSync(envSrc)) {
  copyFileSync(envSrc, envDst)
  console.log("✓ .env تازه در .next/standalone کپی شد (SHOW_DEV_OTP و DATABASE_URL به‌روز)")
}
