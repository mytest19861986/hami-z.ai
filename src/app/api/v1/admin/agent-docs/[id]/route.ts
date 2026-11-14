import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { fail, requirePermission } from "@/lib/api"
import { db } from "@/lib/db"

// سرو فایل مدرک نماینده برای پیش‌نمایش ادمین: /api/v1/admin/agent-docs/<documentId>
// فایل‌ها در مسیر خصوصی db/uploads/agent-docs ذخیره می‌شوند (SEC-014) و فقط
// بررسی‌کنندگان مجاز (agents.view_all) می‌توانند محتوا را ببینند — بدون احراز
// هویت، فایل قابل دسترس نیست.
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("agents.view_all")
  if ("response" in auth) return auth.response

  const { id } = await params
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return fail("شناسه مدرک نامعتبر است.", 422)

  const doc = await db.agentDocument.findUnique({ where: { id } })
  if (!doc) return fail("مدرک یافت نشد.", 404)

  // جلوگیری از path traversal: مسیر ذخیره‌شده باید دقیقاً الگوی agent-docs/<agentId>/<file> باشد
  if (!/^agent-docs\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(doc.filePath)) {
    return fail("مسیر فایل نامعتبر است.", 422 )
  }
  const rel = doc.filePath.split("/").slice(1).join("/") // <agentId>/<file>
  const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "")
  const filePath = path.join(process.cwd(), "db", "uploads", "agent-docs", safe)

  // اطمینان نهایی: مسیر حل‌شده داخل پوشهٔ مجاز بماند
  const allowedRoot = path.join(process.cwd(), "db", "uploads", "agent-docs")
  if (!filePath.startsWith(allowedRoot + path.sep)) return fail("مسیر فایل نامعتبر است.", 422)

  try {
    const buf = await readFile(filePath)
    const ext = doc.filePath.split(".").pop()!.toLowerCase()
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch {
    return fail("فایل مدرک روی سرور یافت نشد.", 404)
  }
}
