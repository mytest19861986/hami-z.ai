import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { SETTING_DEFAULTS } from "@/lib/settings"
import { toEnDigits } from "@/lib/validators"

// تنظیمات محصول (ADMIN-023 · ADMIN-020: تغییر تنظیم حساس فقط مدیر ارشد)
export async function GET() {
  const auth = await requirePermission("settings.view")
  if ("response" in auth) return auth.response

  const rows = await db.setting.findMany()
  const map = new Map(rows.map((r) => [r.key, r]))
  const settings = Object.entries(SETTING_DEFAULTS).map(([key, def]) => ({
    key,
    value: map.get(key)?.value ?? def.value,
    title: def.title,
    description: def.description ?? null,
    superOnly: !!def.superOnly,
  }))
  return ok({ settings, isSuperAdmin: auth.user.roles.includes("SUPER_ADMIN") })
}

const schema = z.object({
  key: z.string(),
  value: z.string().trim().min(1, "مقدار تنظیم الزامی است.").max(500),
})

export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.manage")
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, schema)
  if ("response" in parsed) return parsed.response
  const { key, value } = parsed.data

  const def = SETTING_DEFAULTS[key]
  if (!def) return fail("کلید تنظیم معتبر نیست.", 422)

  if (key === "MIN_SETTLEMENT_AMOUNT") {
    const n = parseInt(toEnDigits(value), 10)
    if (isNaN(n) || n < 10000) return fail("حداقل مبلغ تسویه باید عددی و حداقل ۱۰٬۰۰۰ تومان باشد.", 422)
  }

  await db.setting.upsert({
    where: { key },
    update: { value: toEnDigits(value), updatedById: auth.user.id },
    create: { key, value: toEnDigits(value), title: def.title, description: def.description ?? null, updatedById: auth.user.id },
  })
  await audit(auth.user, "SETTING_UPDATE", "SETTING", key, { value })
  return ok({ updated: true })
}
