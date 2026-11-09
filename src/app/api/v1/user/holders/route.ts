import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { nationalCodeSchema, mobileSchema, toEnDigits } from "@/lib/validators"
import { isValidNationalCode } from "@/lib/validators"

// دارندگان طرح مرتبط با کاربر (HOLDER-001..004 · USER-003)
export async function GET() {
  const auth = await requireUser()
  if ("response" in auth) return auth.response

  const holders = await db.planHolder.findMany({
    where: { OR: [{ createdByUserId: auth.user.id }, { purchases: { some: { buyerUserId: auth.user.id } } }] },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { plan: { select: { id: true, title: true, discountPercent: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return ok(
    holders.map((h) => ({
      id: h.id,
      firstName: h.firstName,
      lastName: h.lastName,
      nationalCode: h.nationalCode,
      mobile: h.mobile,
      isSelf: h.createdByUserId === auth.user.id && h.mobile === auth.user.mobile,
      activeMemberships: h.memberships.map((m) => ({
        id: m.id,
        planTitle: m.plan.title,
        endDate: m.endDate,
        usageLimit: m.usageLimit,
        usedCount: m.usedCount,
      })),
    }))
  )
}

const createHolderSchema = z.object({
  firstName: z.string().trim().min(2, "نام دارنده حداقل ۲ نویسه است").max(50),
  lastName: z.string().trim().min(2, "نام خانوادگی حداقل ۲ نویسه است").max(50),
  nationalCode: nationalCodeSchema,
  mobile: mobileSchema.optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, createHolderSchema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  const nationalCode = toEnDigits(data.nationalCode).trim()
  if (!isValidNationalCode(nationalCode)) return fail("کد ملی دارنده معتبر نیست.", 422)

  // HOLDER-003: کد ملی دارنده یکتاست
  const dup = await db.planHolder.findUnique({ where: { nationalCode } })
  if (dup) {
    // اگر دارنده قبلاً توسط همین کاربر ساخته شده، همان را برمی‌گردانیم (ایدمپوتنت)
    if (dup.createdByUserId === auth.user.id) return ok({ holder: dup, reused: true })
    return fail("دارنده‌ای با این کد ملی قبلاً ثبت شده است.", 409)
  }

  const holder = await db.planHolder.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      nationalCode,
      mobile: data.mobile || null,
      createdByUserId: auth.user.id,
    },
  })
  return ok({ holder, reused: false })
}
