import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit, notify } from "@/lib/audit"

// مدیریت محتوا (CONTENT-003/004 · NOTICE-001) + اعلان همگانی
export async function GET() {
  const auth = await requirePermission("content.manage")
  if ("response" in auth) return auth.response
  const pages = await db.pageContent.findMany({ orderBy: { pageKey: "asc" } })
  return ok(pages)
}

const pageSchema = z.object({
  pageKey: z.enum(["about", "contact", "faq", "terms", "privacy"]),
  title: z.string().trim().min(2, "عنوان الزامی است.").max(150),
  body: z.string().trim().min(10, "متن صفحه حداقل ۱۰ نویسه است.").max(20000),
  status: z.enum(["DRAFT", "PUBLISHED"]),
})

export async function PUT(req: NextRequest) {
  const auth = await requirePermission("content.manage")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, pageSchema)
  if ("response" in parsed) return parsed.response
  const d = parsed.data

  await db.pageContent.upsert({
    where: { pageKey: d.pageKey },
    update: { title: d.title, body: d.body, status: d.status, updatedById: auth.user.id },
    create: { pageKey: d.pageKey, title: d.title, body: d.body, status: d.status, updatedById: auth.user.id },
  })
  await audit(auth.user, "CONTENT_UPDATE", "PAGE_CONTENT", d.pageKey, { status: d.status })
  return ok({ updated: true })
}

const broadcastSchema = z.object({
  action: z.literal("broadcast"),
  title: z.string().trim().min(2, "عنوان الزامی است.").max(120),
  body: z.string().trim().min(2, "متن الزامی است.").max(600),
  audience: z.enum(["ALL", "ACTIVE_MEMBERS", "AGENTS", "DOCTORS"]),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission("notifications.broadcast")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, broadcastSchema)
  if ("response" in parsed) return parsed.response
  const d = parsed.data

  const now = new Date()
  let userIds: string[] = []
  if (d.audience === "ALL") {
    userIds = (await db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } })).map((u) => u.id)
  } else if (d.audience === "ACTIVE_MEMBERS") {
    userIds = (await db.membership.findMany({ where: { status: "ACTIVE", endDate: { gte: now } }, select: { buyerUserId: true } })).map((m) => m.buyerUserId!).filter(Boolean)
  } else if (d.audience === "AGENTS") {
    userIds = (await db.agent.findMany({ where: { status: "APPROVED" }, select: { userId: true } })).map((a) => a.userId)
  } else {
    userIds = (await db.doctor.findMany({ where: { status: "APPROVED" }, select: { userId: true } })).map((x) => x.userId)
  }

  userIds = Array.from(new Set(userIds))
  if (userIds.length > 0) {
    await db.notification.createMany({ data: userIds.map((id) => ({ userId: id, title: d.title, body: d.body, type: "INFO" })) })
  }
  await audit(auth.user, "NOTIFICATION_BROADCAST", "NOTIFICATION", null, { audience: d.audience, count: userIds.length })
  return ok({ sent: userIds.length })
}
