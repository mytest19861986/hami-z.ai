import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { mkdir, writeFile, unlink } from "fs/promises"
import path from "path"
import { randomToken } from "@/lib/password"

// تنظیمات صفحه اصلی — بنرهای اسلایدی (جایگاه «عکس کارت» در هیرو)
// الگو همان آپلود مدارک نماینده: base64 + تشخیص نوع از امضای فایل، ذخیره در db/uploads/

const BANNER_DIR = "homepage-banners"
// راهنمای سایز: جایگاه بنر نسبت ۴:۳ نزدیک است؛ عرض پیشنهادی ۹۶۰px
const MAX_BANNER_BYTES = 3_000_000

function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8
  const isPng = buf.subarray(0, 4).toString("hex") === "89504e47"
  const isWebp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP"
  if (isJpeg) return { ext: "jpg", mime: "image/jpeg" }
  if (isPng) return { ext: "png", mime: "image/png" }
  if (isWebp) return { ext: "webp", mime: "image/webp" }
  return null
}

// ─── GET: لیست همهٔ بنرها (فعال و غیرفعال) برای پنل مدیریت ───
export async function GET() {
  const auth = await requirePermission("settings.view")
  if ("response" in auth) return auth.response

  const banners = await db.homepageBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      imageUrl: true,
      title: true,
      linkUrl: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
    },
  })
  return ok({ banners })
}

// ─── POST: افزودن بنر جدید (آپلود عکس base64 یا لینک خارجی) ───
const createSchema = z.object({
  mode: z.literal("upload"),
  fileBase64: z.string().min(16),
  fileName: z.string().trim().max(200).optional().or(z.literal("")),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  linkUrl: z.string().trim().max(300).optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission("settings.manage")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, createSchema)
  if ("response" in parsed) return parsed.response
  const { fileBase64, fileName, title, linkUrl } = parsed.data

  const base64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64
  const buf = Buffer.from(base64, "base64")
  if (buf.length === 0 || buf.length > MAX_BANNER_BYTES) {
    return fail("حجم فایل نامعتبر است. بنر حداکثر ۳ مگابایت می‌تواند باشد.", 422)
  }
  const sniffed = sniffImage(buf)
  if (!sniffed) return fail("فرمت بنر فقط JPG، PNG یا WebP مجاز است.", 422)

  // اعتبارسنجی سادهٔ لینک (در صورت واردکردن)
  if (linkUrl && !/^https?:\/\/|^\/[^/]/.test(linkUrl)) {
    return fail("لینک بنر باید با http(s):// شروع شود یا یک مسیر داخلی مثل /plans باشد.", 422)
  }

  // ذخیرهٔ فیزیکی
  const dir = path.join(process.cwd(), "db", "uploads", BANNER_DIR)
  await mkdir(dir, { recursive: true })
  const storedName = `banner-${Date.now()}-${randomToken(8)}.${sniffed.ext}`
  await writeFile(path.join(dir, storedName), buf)

  // ترتیب نمایش: بعد از آخرین بنر
  const last = await db.homepageBanner.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })

  const [banner] = await db.$transaction([
    db.homepageBanner.create({
      data: {
        uploadId: null,
        imageUrl: `/api/v1/public/banners/${storedName}`,
        title: title || null,
        linkUrl: linkUrl || null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        isActive: true,
        createdById: auth.user.id,
      },
    }),
    db.upload.create({
      data: {
        ownerUserId: auth.user.id,
        purpose: "HOMEPAGE_BANNER",
        fileName: `${toSafeName(fileName) || "banner"}.${sniffed.ext}`,
        filePath: `${BANNER_DIR}/${storedName}`,
        mimeType: sniffed.mime,
        sizeBytes: buf.length,
      },
    }),
  ])
  await audit(auth.user, "HOMEPAGE_BANNER_CREATE", "HOMEPAGE_BANNER", banner.id, { title: title || null })
  return ok({ id: banner.id, imageUrl: banner.imageUrl })
}

function toSafeName(name?: string): string {
  return (name ?? "").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)
}

// ─── PUT: ویرایش بنر (فعال/غیرفعال، عنوان، لینک، ترتیب) ───
const updateSchema = z.object({
  bannerId: z.string(),
  isActive: z.boolean().optional(),
  title: z.string().trim().max(120).optional(),
  linkUrl: z.string().trim().max(300).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(999).optional(),
})

export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.manage")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, updateSchema)
  if ("response" in parsed) return parsed.response
  const { bannerId, ...changes } = parsed.data

  const existing = await db.homepageBanner.findUnique({ where: { id: bannerId } })
  if (!existing) return fail("بنر یافت نشد.", 404)
  if (Object.keys(changes).length === 0) return fail("تغییری ارسال نشده است.", 422)

  await db.homepageBanner.update({
    where: { id: bannerId },
    data: {
      ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
      ...(changes.title !== undefined ? { title: changes.title || null } : {}),
      ...(changes.linkUrl !== undefined ? { linkUrl: changes.linkUrl || null } : {}),
      ...(changes.sortOrder !== undefined ? { sortOrder: changes.sortOrder } : {}),
    },
  })
  await audit(auth.user, "HOMEPAGE_BANNER_UPDATE", "HOMEPAGE_BANNER", bannerId, changes)
  return ok({ updated: true })
}

// ─── DELETE: حذف کامل بنر + فایل فیزیکی آن ───
const deleteSchema = z.object({ bannerId: z.string() })

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("settings.manage")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, deleteSchema)
  if ("response" in parsed) return parsed.response
  const { bannerId } = parsed.data

  const banner = await db.homepageBanner.findUnique({ where: { id: bannerId } })
  if (!banner) return fail("بنر یافت نشد.", 404)

  // حذف فایل فیزیکی در صورت تعلق به سرو داخلی
  if (banner.imageUrl.startsWith("/api/v1/public/banners/")) {
    const name = banner.imageUrl.split("/").pop()!
    try {
      await unlink(path.join(process.cwd(), "db", "uploads", BANNER_DIR, path.basename(name)))
    } catch {
      // فایل ممکن است قبلاً حذف شده باشد؛ رکورد را در هر حال پاک می‌کنیم
    }
  }

  await db.homepageBanner.delete({ where: { id: bannerId } })
  await audit(auth.user, "HOMEPAGE_BANNER_DELETE", "HOMEPAGE_BANNER", bannerId, { imageUrl: banner.imageUrl })
  return ok({ deleted: true })
}
