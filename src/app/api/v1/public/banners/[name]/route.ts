import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

// سرو عمومی عکس بنر صفحهٔ اصلی: /api/v1/public/banners/<fileName>
// فقط نام فایل امن (بدون مسیر) از پوشهٔ db/uploads/homepage-banners خوانده می‌شود.
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  // جلوگیری از path traversal: فقط نام فایل ساده با پسوند مجاز
  const safe = path.basename(name)
  if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(safe)) {
    return NextResponse.json({ ok: false, error: "نام فایل نامعتبر است." }, { status: 422 })
  }

  try {
    const buf = await readFile(path.join(process.cwd(), "db", "uploads", "homepage-banners", safe))
    const ext = safe.split(".").pop()!.toLowerCase()
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=60",
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "بنر یافت نشد." }, { status: 404 })
  }
}
