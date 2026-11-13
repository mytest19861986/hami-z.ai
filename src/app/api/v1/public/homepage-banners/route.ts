import { NextRequest } from "next/server"
import { ok } from "@/lib/api"
import { db } from "@/lib/db"
import { readFile } from "fs/promises"
import path from "path"

// بنرهای فعال صفحهٔ اصلی برای اسلایدر (عمومی — بدون احراز هویت)
export async function GET() {
  const banners = await db.homepageBanner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, imageUrl: true, title: true, linkUrl: true },
    take: 10,
  })
  return ok({ banners })
}
