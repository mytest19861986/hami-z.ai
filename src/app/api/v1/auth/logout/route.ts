import { ok } from "@/lib/api"
import { revokeCurrentSession } from "@/lib/auth"

// خروج — اعتبار نشست سلب می‌شود (AUTH-010 · AC-14)
export async function POST() {
  await revokeCurrentSession()
  return ok({ loggedOut: true })
}
