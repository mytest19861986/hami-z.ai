import { ok } from "@/lib/api"
import { getCurrentUser } from "@/lib/auth"
import { roleHome } from "@/constants/permissions"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return ok(null)
  return ok({ ...user, home: roleHome(user.roles) })
}
