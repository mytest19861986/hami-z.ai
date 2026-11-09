// ثبت رخداد مدیریتی (SEC-006 · ADMIN-027) و اعلان درون‌سامانه‌ای (NOTICE-001)
import { db } from "@/lib/db"
import type { AuthUser } from "@/lib/auth"

export async function audit(
  actor: AuthUser | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
  ip?: string | null
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorUserId: actor?.id ?? null,
        actorName: actor?.profile ? `${actor.profile.firstName ?? ""} ${actor.profile.lastName ?? ""}`.trim() || actor.mobile : actor?.mobile ?? "سیستم",
        action,
        entityType,
        entityId: entityId ?? null,
        details: details ? JSON.stringify(details) : null,
        ip: ip ?? null,
      },
    })
  } catch (e) {
    console.error("[AUDIT_FAIL]", e)
  }
}

export async function notify(
  userId: string,
  title: string,
  body?: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
  linkUrl?: string
): Promise<void> {
  try {
    await db.notification.create({ data: { userId, title, body, type, linkUrl } })
  } catch (e) {
    console.error("[NOTIFY_FAIL]", e)
  }
}
