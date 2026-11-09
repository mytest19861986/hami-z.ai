import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomToken } from "@/lib/password"
import { toEnDigits } from "@/lib/validators"

// ثبت مدارک همکاری (AGENT-003/004 · SEC-014: ذخیره در مسیر خصوصی)
const schema = z.object({
  docType: z.enum(["NATIONAL_CARD", "BUSINESS_LICENSE", "OTHER"]),
  fileName: z.string().trim().min(3).max(200),
  fileBase64: z.string().min(10, "فایل معتبر نیست.").max(3_000_000, "حجم فایل بیش از حد مجاز است (حداکثر ~۲MB)."),
})

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"]

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const agent = await db.agent.findUnique({ where: { userId: auth.user.id } })
  if (!agent) return fail("ابتدا درخواست همکاری ثبت کنید.", 404)
  if (!["PENDING", "UNDER_REVIEW", "APPROVED"].includes(agent.status)) {
    return fail("وضعیت پرونده اجازه بارگذاری مدرک ندارد.", 409)
  }

  const parsed = await parseBody(req, schema)
  if ("response" in parsed) return parsed.response
  const { docType, fileName, fileBase64 } = parsed.data

  const base64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64
  const buf = Buffer.from(base64, "base64")
  if (buf.length === 0 || buf.length > 2_500_000) return fail("حجم فایل نامعتبر است.", 422)

  // تشخیص نوع فایل از امضای محتوا (نه ادعای کاربر)
  const isPdf = buf.subarray(0, 4).toString("hex") === "25504446"
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8
  const isPng = buf.subarray(0, 4).toString("hex") === "89504e47"
  const isWebp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP"
  if (!isPdf && !isJpeg && !isPng && !isWebp) return fail("فرمت فایل فقط JPG، PNG، WebP یا PDF مجاز است.", 422)
  const mime = isPdf ? "application/pdf" : isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp"
  if (!ALLOWED_MIME.includes(mime)) return fail("فرمت فایل مجاز نیست.", 422)

  const ext = isPdf ? "pdf" : isJpeg ? "jpg" : isPng ? "png" : "webp"
  const dir = path.join(process.cwd(), "db", "uploads", "agent-docs", agent.id)
  await mkdir(dir, { recursive: true })
  const storedName = `${docType}-${Date.now()}-${randomToken(8)}.${ext}`
  await writeFile(path.join(dir, storedName), buf)

  const doc = await db.agentDocument.create({
    data: { agentId: agent.id, docType, fileName: toEnDigits(fileName) || fileName, filePath: `agent-docs/${agent.id}/${storedName}`, status: "PENDING" },
  })

  // آپلود در جدول Upload نیز ثبت می‌شود (SEC-014: دسترسی فقط برای بررسی‌کنندگان مجاز)
  await db.upload.create({
    data: { ownerUserId: auth.user.id, purpose: "AGENT_DOC", fileName: `${fileName}.${ext}`, filePath: doc.filePath, mimeType: mime, sizeBytes: buf.length },
  })

  return ok({ documentId: doc.id, status: doc.status })
}
