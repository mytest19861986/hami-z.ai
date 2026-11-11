import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { fail, requirePermission, parseBody } from "@/lib/api"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import { buildXlsx, type XlsxCell } from "@/lib/xlsx-mini"
import { faDateTime } from "@/lib/jalali"

// خروجی اکسل تسویه‌های تأییدشدهٔ انتخابی (EXPORT-SETTLE · ADMIN-019)
// فقط ردیف‌های «تأییدشده» خروجی داده می‌شوند؛ شماره کارت/شبا کامل در ستون‌های
// متنی می‌آیند تا صفرِ ابتدای موبایل و ارقام کارت در اکسل حفظ شود.
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "حداقل یک مورد را انتخاب کنید.")
    .max(500, "حداکثر ۵۰۰ مورد در هر خروجی."),
})

export async function POST(req: NextRequest) {
  const auth = await requirePermission("settlements.view_all")
  if ("response" in auth) return auth.response

  const parsed = await parseBody(req, bodySchema)
  if ("response" in parsed) return parsed.response

  // اعمال سیاست سمت سرور: فقط تأییدشده‌ها — حتی اگر شناسهٔ دیگری ارسال شود
  const rows = await db.settlementRequest.findMany({
    where: { id: { in: parsed.data.ids }, status: "APPROVED" },
    include: { user: { select: { mobile: true, profile: { select: { firstName: true, lastName: true } } } } },
    orderBy: { createdAt: "asc" }, // قدیمی‌ترین اول — منطق پرداخت FIFO
  })
  if (rows.length === 0) {
    return fail("در میان موارد انتخابی، تسویهٔ تأییدشده‌ای یافت نشد.", 404)
  }

  const total = rows.reduce((s, r) => s + r.amount, 0)

  const header = ["ردیف", "متقاضی", "موبایل", "مبلغ (تومان)", "شماره کارت", "شماره شبا", "به نام", "کد پیگیری", "تاریخ درخواست"].map((v) => ({ v, bold: true }))

  const body: XlsxCell[][] = rows.map((s, i) => {
    const applicant = `${s.user.profile?.firstName ?? ""} ${s.user.profile?.lastName ?? ""}`.trim() || s.user.mobile
    return [
      { v: i + 1, t: "n" as const },
      { v: applicant },
      { v: s.user.mobile },
      { v: s.amount, t: "n" as const, thousands: true },
      { v: s.bankCardNumber },
      { v: s.bankSheba },
      { v: s.bankAccountName },
      { v: s.trackingCode },
      { v: faDateTime(s.createdAt) },
    ]
  })

  // سطر جمع کل — برچسب زیر «ردیف» و مبلغ زیر ستون «مبلغ (تومان)»
  const filler = (n: number) => Array.from({ length: n }, () => ({ v: "" }))
  body.push([{ v: "جمع کل", bold: true }, ...filler(2), { v: total, t: "n" as const, bold: true, thousands: true }, ...filler(5)])

  const buf = buildXlsx([
    {
      name: "تسویه‌های تأییدشده",
      rows: [header, ...body],
      widths: [6, 20, 14, 14, 20, 28, 20, 16, 22],
      rtl: true,
    },
  ])

  // رخداد حساس: خروجی شماره کارت/شبای کامل — ثبت در رخدادهای سیستم (SEC-006)
  await audit(auth.user, "SETTLEMENT_EXPORT_XLSX", "SETTLEMENT", rows[0].id, {
    count: rows.length,
    totalAmount: total,
    requestedIds: parsed.data.ids.length,
    trackingCodes: rows.map((r) => r.trackingCode),
  })

  const fileName = `hami-settlements-${new Date().toISOString().slice(0, 10)}.xlsx`
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Export-Count": String(rows.length),
      "X-Export-Total": String(total),
      "Cache-Control": "no-store",
    },
  })
}
