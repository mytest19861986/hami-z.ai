import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { mkdir, writeFile, unlink } from "fs/promises"
import path from "path"
import { randomToken } from "@/lib/password"

// عکس پروفایل پزشک (DOCTOR-DASH-007) — پزشک عکس خودش را بارگذاری می‌کند
// الگو همان آپلود بنر صفحهٔ اصلی: base64 + تشخیص نوع از امضای فایل، ذخیره در db/uploads/doctor-avatars/
// هر بارگذاری عکس قبلی را جایگزین می‌کند (یک عکس پروفایل به‌ازای پزشک).

const AVATAR_DIR = "doctor-avatars"
// عکس پروفایل مربعی نمایش داده می‌شود؛ پیشنهاد ۴۰۰×۴۰۰px، حداکثر ۲MB
const MAX_AVATAR_BYTES = 2_000_000

function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8
  const isPng = buf.subarray(0, 4).toString("hex") === "89504e47"
  const isWebp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP"
  if (isJpeg) return { ext: "jpg", mime: "image/jpeg" }
  if (isPng) return { ext: "png", mime: "image/png" }
  if (isWebp) return { ext: "webp", mime: "image/webp" }
  return null
}

function toSafeName(name?: string): string {
  return (name ?? "").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)
}

// نام فیزیکی عکس قبلی از avatarUrl استخراج می‌شود تا پس از جایگزینی حذف شود
function oldFileName(avatarUrl: string | null): string | null {
  if (!avatarUrl?.startsWith("/api/v1/public/avatars/")) return null
  return path.basename(avatarUrl)
}

const uploadSchema = z.object({
  fileBase64: z.string().min(16, "فایل عکس ارسال نشده است."),
  fileName: z.string().trim().max(200).optional().or(z.literal("")),
})

// ─── POST: بارگذاری/جایگزینی عکس پروفایل ───
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const doctor = await db.doctor.findUnique({ where: { userId: auth.user.id } })
  if (!doctor) return fail("پروفایل پزشکی یافت نشد.", 404)

  const parsed = await parseBody(req, uploadSchema)
  if ("response" in parsed) return parsed.response
  const { fileBase64, fileName } = parsed.data

  const base64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64
  const buf = Buffer.from(base64, "base64")
  if (buf.length === 0 || buf.length > MAX_AVATAR_BYTES) {
    return fail("حجم فایل نامعتبر است. عکس پروفایل حداکثر ۲ مگابایت می‌تواند باشد.", 422)
  }
  const sniffed = sniffImage(buf)
  if (!sniffed) return fail("فرمت عکس فقط JPG، PNG یا WebP مجاز است.", 422)

  // ذخیرهٔ فیزیکی فایل جدید
  const dir = path.join(process.cwd(), "db", "uploads", AVATAR_DIR)
  await mkdir(dir, { recursive: true })
  const storedName = `avatar-${doctor.id}-${Date.now()}-${randomToken(6)}.${sniffed.ext}`
  await writeFile(path.join(dir, storedName), buf)

  const avatarUrl = `/api/v1/public/avatars/${storedName}`
  const previous = oldFileName(doctor.avatarUrl)

  const [updated] = await db.$transaction([
    db.doctor.update({
      where: { id: doctor.id },
      data: { avatarUrl },
    }),
    db.upload.create({
      data: {
        ownerUserId: auth.user.id,
        purpose: "DOCTOR_AVATAR",
        fileName: `${toSafeName(fileName) || "avatar"}.${sniffed.ext}`,
        filePath: `${AVATAR_DIR}/${storedName}`,
        mimeType: sniffed.mime,
        sizeBytes: buf.length,
      },
    }),
  ])

  // حذف فایل فیزیکی عکس قبلی (در صورت وجود) پس از ثبت موفق
  if (previous && previous !== storedName) {
    try {
      await unlink(path.join(dir, previous))
    } catch {
      // فایل قبلی ممکن است حذف شده باشد؛ نادیده می‌گیریم
    }
  }

  await audit(auth.user, "DOCTOR_AVATAR_UPDATE", "DOCTOR", doctor.id, { avatarUrl })
  return ok({ avatarUrl: updated.avatarUrl })
}

// ─── DELETE: حذف عکس پروفایل ───
export async function DELETE() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const doctor = await db.doctor.findUnique({ where: { userId: auth.user.id } })
  if (!doctor) return fail("پروفایل پزشکی یافت نشد.", 404)
  if (!doctor.avatarUrl) return fail("عکس پروفایلی برای حذف وجود ندارد.", 404)

  const previous = oldFileName(doctor.avatarUrl)
  await db.doctor.update({ where: { id: doctor.id }, data: { avatarUrl: null } })

  if (previous) {
    try {
      await unlink(path.join(process.cwd(), "db", "uploads", AVATAR_DIR, previous))
    } catch {
      // فایل ممکن است حذف شده باشد
    }
  }

  await audit(auth.user, "DOCTOR_AVATAR_DELETE", "DOCTOR", doctor.id, { previousUrl: doctor.avatarUrl })
  return ok({ deleted: true })
}
