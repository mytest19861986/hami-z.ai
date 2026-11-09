import { NextRequest } from "next/server"
import { ok, requirePermission } from "@/lib/api"
import { db } from "@/lib/db"

// رخدادهای مدیریتی (ADMIN-025 · SEC-006 · RBAC-008)
export async function GET(req: NextRequest) {
  const auth = await requirePermission("audit.view")
  if ("response" in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const q = (sp.get("q") ?? "").trim()
  const entityType = sp.get("entityType") ?? ""
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
  const perPage = 30

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(q ? { OR: [{ action: { contains: q } }, { actorName: { contains: q } }, { entityId: { contains: q } }] } : {}),
  }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
  ])

  return ok({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    logs: logs.map((l) => ({
      id: l.id,
      actorName: l.actorName,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details ? JSON.parse(l.details) : null,
      createdAt: l.createdAt,
    })),
  })
}
