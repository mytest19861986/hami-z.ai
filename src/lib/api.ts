// ابزارهای مشترک API روت‌ها
import { NextRequest, NextResponse } from "next/server"
import { ZodError, ZodType } from "zod"
import { getCurrentUser, hasPermission, AuthUser } from "@/lib/auth"

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 })
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status })
}

export function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return { response: fail("بدنه درخواست معتبر نیست.", 400) }
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { response: fail(first?.message ?? "داده ارسالی نامعتبر است.", 422) }
  }
  return { data: parsed.data }
}

export async function requireUser(): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const user = await getCurrentUser()
  if (!user) return { response: fail("ابتدا وارد حساب خود شوید.", 401) }
  return { user }
}

export async function requirePermission(
  permission: string
): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const user = await getCurrentUser()
  if (!user) return { response: fail("ابتدا وارد حساب خود شوید.", 401) }
  if (!hasPermission(user, permission)) {
    return { response: fail("شما مجوز انجام این عملیات را ندارید.", 403) }
  }
  return { user }
}

export function zodMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "داده نامعتبر است."
  if (e instanceof Error) return e.message
  return "خطای ناشناخته"
}
