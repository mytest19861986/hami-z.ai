import { ok, fail } from "@/lib/api"
import { refreshSession } from "@/lib/auth"

// تمدید نشست — هر اعتبار تمدید حداکثر یک جانشین می‌سازد (AUTH-011 · AC-15)
export async function POST() {
  const refreshed = await refreshSession()
  if (!refreshed) return fail("نشست معتبر نیست. دوباره وارد شوید.", 401)
  return ok({ refreshed: true })
}
