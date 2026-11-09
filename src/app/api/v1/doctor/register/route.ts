import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail, requireUser, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { isValidProvinceCity } from "@/constants/geo"
import { SPECIALTIES } from "@/constants/specialties"
import { toEnDigits } from "@/lib/validators"

// درخواست همکاری پزشک (DOC-007..010 · AC-02)
const schema = z.object({
  medicalCouncilCode: z.string()
    .transform((s) => toEnDigits(s).trim())
    .refine((s) => /^\d{4,12}$/.test(s), "کد نظام پزشکی معتبر نیست."),
  specialty: z.string().refine((s) => (SPECIALTIES as readonly string[]).includes(s), "تخصص را از فهرست انتخاب کنید."),
  clinicName: z.string().trim().min(2, "نام مطب/کلینیک الزامی است.").max(120),
  clinicAddress: z.string().trim().max(400).optional().or(z.literal("")),
  province: z.string().min(1, "استان را انتخاب کنید."),
  city: z.string().min(1, "شهر را انتخاب کنید."),
  clinicPhone: z.string().trim().max(20).optional().or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ("response" in auth) return auth.response
  const parsed = await parseBody(req, schema)
  if ("response" in parsed) return parsed.response
  const data = parsed.data

  if (!isValidProvinceCity(data.province, data.city)) {
    return fail("شهر انتخاب‌شده به استان تعلق ندارد.", 422)
  }

  const existing = await db.doctor.findUnique({ where: { userId: auth.user.id } })
  if (existing) {
    if (existing.status === "APPROVED") return fail("درخواست پزشکی شما قبلاً تأیید شده است.", 409)
    if (existing.status === "PENDING") return fail("درخواست شما در انتظار بررسی است.", 409)
    return fail("وضعیت درخواست پزشکی شما اجازه ثبت مجدد نمی‌دهد. با پشتیبانی تماس بگیرید.", 409)
  }

  const dupCode = await db.doctor.findUnique({ where: { medicalCouncilCode: data.medicalCouncilCode } })
  if (dupCode) return fail("این کد نظام پزشکی قبلاً ثبت شده است.", 409)

  const doctor = await db.doctor.create({
    data: {
      userId: auth.user.id,
      medicalCouncilCode: data.medicalCouncilCode,
      specialty: data.specialty,
      clinicName: data.clinicName,
      clinicAddress: data.clinicAddress || null,
      province: data.province,
      city: data.city,
      clinicPhone: data.clinicPhone || null,
      bio: data.bio || null,
      status: "PENDING",
    },
  })

  // نقش پزشک اضافه می‌شود اما داشبورد عملیاتی تا تأیید مدیر فعال نیست (RBAC-004)
  await db.userRole.upsert({
    where: { userId_roleId: { userId: auth.user.id, roleId: (await db.role.findUnique({ where: { name: "DOCTOR" } }))!.id } },
    update: {},
    create: { userId: auth.user.id, roleId: (await db.role.findUnique({ where: { name: "DOCTOR" } }))!.id },
  })

  await audit(auth.user, "DOCTOR_REGISTER_REQUEST", "DOCTOR", doctor.id, { specialty: data.specialty })
  return ok({ doctorId: doctor.id, status: doctor.status })
}
