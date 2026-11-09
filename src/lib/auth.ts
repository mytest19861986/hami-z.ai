// نشست‌ها: توکن دسترسی + تمدید یک‌بارمصرف (AUTH-010..012 · AC-14 · AC-15 · SEC-012)
import { db } from "@/lib/db"
import { randomToken, sha256 } from "@/lib/password"
import { cookies } from "next/headers"

const ACCESS_TTL_MS = 30 * 60_000 // ۳۰ دقیقه
const REFRESH_TTL_MS = 30 * 86400_000 // ۳۰ روز
export const ACCESS_COOKIE = "hk_at"
export const REFRESH_COOKIE = "hk_rt"

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
}

export interface AuthUser {
  id: string
  mobile: string
  status: string
  hasPassword: boolean
  profile: {
    firstName: string | null
    lastName: string | null
    nationalCode: string | null
    province: string | null
    city: string | null
    cardNumber: string | null
    sheba: string | null
    bankAccountName: string | null
  } | null
  roles: string[]
  permissions: string[]
  doctor?: { id: string; status: string } | null
  agent?: { id: string; status: string } | null
}

export async function createSession(
  userId: string,
  ip?: string | null,
  userAgent?: string | null
): Promise<void> {
  const accessToken = randomToken()
  const refreshToken = randomToken()
  const now = Date.now()
  await db.session.create({
    data: {
      userId,
      accessHash: sha256(accessToken),
      accessExpiresAt: new Date(now + ACCESS_TTL_MS),
      refreshHash: sha256(refreshToken),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    },
  })
  const jar = await cookies()
  jar.set(ACCESS_COOKIE, accessToken, { ...baseCookie, maxAge: ACCESS_TTL_MS / 1000 })
  jar.set(REFRESH_COOKIE, refreshToken, { ...baseCookie, maxAge: REFRESH_TTL_MS / 1000 })
}

/** تمدید نشست — تضمین حداکثر یک جانشین معتبر برای هر اعتبار تمدید (AC-15) */
export async function refreshSession(): Promise<boolean> {
  const jar = await cookies()
  const rt = jar.get(REFRESH_COOKIE)?.value
  if (!rt) return false

  const session = await db.session.findUnique({ where: { refreshHash: sha256(rt) } })
  if (!session) return false

  const now = new Date()
  if (session.revokedAt || session.refreshUsedAt) return false
  if (new Date(session.refreshExpiresAt) < now) return false

  // مصرف اتمیک اعتبار تمدید: فقط اگر هنوز مصرف‌نشده باشد
  const res = await db.session.updateMany({
    where: { id: session.id, refreshUsedAt: null, revokedAt: null },
    data: { refreshUsedAt: now, revokedAt: now },
  })
  if (res.count === 0) return false

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user || user.status !== "ACTIVE") return false

  await createSession(user.id, session.ip, session.userAgent)
  return true
}

export async function revokeCurrentSession(): Promise<void> {
  const jar = await cookies()
  const rt = jar.get(REFRESH_COOKIE)?.value
  const at = jar.get(ACCESS_COOKIE)?.value
  if (rt) {
    await db.session.updateMany({ where: { refreshHash: sha256(rt) }, data: { revokedAt: new Date() } })
  }
  if (at) {
    await db.session.updateMany({ where: { accessHash: sha256(at) }, data: { revokedAt: new Date() } })
  }
  jar.delete(ACCESS_COOKIE)
  jar.delete(REFRESH_COOKIE)
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
}

/** کاربر جاری از روی کوکی دسترسی؛ اگر منقضی شد با کوکی تمدید تلاش می‌کند (شفاف برای کاربر) */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies()
  let at = jar.get(ACCESS_COOKIE)?.value

  let session = at
    ? await db.session.findUnique({ where: { accessHash: sha256(at) } })
    : null

  if (!session || session.revokedAt || new Date(session.accessExpiresAt) < new Date()) {
    const refreshed = await refreshSession()
    if (!refreshed) return null
    at = jar.get(ACCESS_COOKIE)?.value
    session = at ? await db.session.findUnique({ where: { accessHash: sha256(at) } }) : null
    if (!session || session.revokedAt) return null
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      profile: true,
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      doctor: { select: { id: true, status: true } },
      agent: { select: { id: true, status: true } },
    },
  })
  if (!user || user.status !== "ACTIVE") return null

  const roles = user.roles.map((r) => r.role.name)
  const permissions = Array.from(
    new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.name)))
  )

  return {
    id: user.id,
    mobile: user.mobile,
    status: user.status,
    hasPassword: !!user.passwordHash,
    profile: user.profile
      ? {
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          nationalCode: user.profile.nationalCode,
          province: user.profile.province,
          city: user.profile.city,
          cardNumber: user.profile.cardNumber,
          sheba: user.profile.sheba,
          bankAccountName: user.profile.bankAccountName,
        }
      : null,
    roles,
    permissions,
    doctor: user.doctor ? { id: user.doctor.id, status: user.doctor.status } : null,
    agent: user.agent ? { id: user.agent.id, status: user.agent.status } : null,
  }
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false
  if (user.roles.includes("SUPER_ADMIN")) return true
  return user.permissions.includes(permission)
}
