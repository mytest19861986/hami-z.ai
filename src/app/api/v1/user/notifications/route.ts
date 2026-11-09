import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"

// اعلان‌های کاربر (NOTICE-001/002)
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const notifications = await db.notification.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return ok({
    items: notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, z.object({ id: z.string().optional(), all: z.boolean().optional() }))
  if ("response" in parsed) return parsed.response
  const { id, all } = parsed.data
  if (all) {
    await db.notification.updateMany({ where: { userId: auth.user.id, isRead: false }, data: { isRead: true } })
  } else if (id) {
    await db.notification.updateMany({ where: { id, userId: auth.user.id }, data: { isRead: true } })
  }
  return ok({ updated: true })
}
