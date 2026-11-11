import Link from "next/link"
import { getCurrentUser, hasPermission } from "@/lib/auth"
import { db } from "@/lib/db"
import { faDateTime } from "@/lib/jalali"
import { formatToman } from "@/lib/format"
import { toFaDigits } from "@/lib/jalali"
import { BrandMark } from "@/components/shared/brand"
import { PrintTrigger } from "./print-trigger"

// نسخهٔ چاپی/PDF تسویه‌های تأییدشده (EXPORT-SETTLE) — خارج از لایوت پنل ادمین،
// با بررسی مجوز «settlements.view_all» در سرور؛ فقط ردیف‌های تأییدشده نمایش می‌یابند.
export const dynamic = "force-dynamic"
export const metadata = { title: "چاپ تسویه‌های تأییدشده" }

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <BrandMark size={48} />
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      <Link href="/auth/login" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
        ورود به حساب مدیر
      </Link>
    </div>
  )
}

export default async function PrintSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) return <AccessDenied message="برای مشاهدهٔ این صفحه ابتدا وارد حساب مدیر شوید." />
  if (!hasPermission(user, "settlements.view_all"))
    return <AccessDenied message="شما مجوز مشاهدهٔ تسویه‌ها را ندارید." />

  const { ids } = await searchParams
  const idList = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 500)

  const rows = idList.length
    ? await db.settlementRequest.findMany({
        where: { id: { in: idList }, status: "APPROVED" }, // سیاست سمت سرور: فقط تأییدشده‌ها
        include: { user: { select: { mobile: true, profile: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: "asc" },
      })
    : []

  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="print-wrap min-h-screen bg-white text-slate-900">
      {/* استایل مستقل صفحهٔ چاپ — سازگار با چاپ A4 */}
      <style>{`
        .print-wrap { font-feature-settings: "ss01"; }
        .print-doc { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
        .doc-table { width: 100%; border-collapse: collapse; font-size: 11px; line-height: 1.9; }
        .doc-table th, .doc-table td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: middle; }
        .doc-table thead th { background: #eef2f7; font-weight: 700; white-space: nowrap; }
        .doc-table tfoot td { background: #f8fafc; font-weight: 700; }
        .num { direction: ltr; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.02em; white-space: nowrap; }
        .amount { white-space: nowrap; }
        @media print {
          body { background: #fff !important; }
          body > * { visibility: hidden; }
          .print-wrap, .print-wrap * { visibility: visible; }
          .print-wrap { position: absolute; inset: 0; min-height: auto; }
          .no-print { display: none !important; }
          .doc-table { font-size: 10px; }
          .doc-table thead { display: table-header-group; }
          .doc-table tr { page-break-inside: avoid; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>

      <div className="print-doc">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <BrandMark size={48} />
            <p className="text-sm leading-6 text-muted-foreground">
              مورد تأییدشده‌ای برای نمایش نیست. از فهرست تسویه‌ها، ردیف‌های «تأییدشده» را انتخاب و دوباره تلاش کنید.
            </p>
            <Link href="/admin/settlements" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
              بازگشت به تسویه‌ها
            </Link>
          </div>
        ) : (
          <>
            {/* سربرگ */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <BrandMark size={40} />
                <div className="leading-tight">
                  <div className="text-lg font-extrabold">حامی‌کارت</div>
                  <div className="text-[11px] text-slate-500">سامانه عضویت و تخفیف خدمات درمانی</div>
                </div>
              </div>
              <div className="text-left text-[11px] leading-5 text-slate-600">
                <div>تاریخ صدور: {faDateTime(new Date())}</div>
                <div>صادرشده از پنل مدیریت — تسویه‌ها</div>
              </div>
            </div>

            <h1 className="mt-5 text-base font-extrabold">فهرست تسویه‌های تأییدشده برای پرداخت</h1>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {toFaDigits(rows.length)} درخواست تأییدشده · جمع کل: {formatToman(total)} — شماره کارت و شبای کامل در زیر آمده است؛
              پرداخت خارج از سامانه انجام و سپس وضعیت «پرداخت‌شده» ثبت می‌شود.
            </p>

            {/* جدول */}
            <table className="doc-table mt-4">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>متقاضی</th>
                  <th>موبایل</th>
                  <th>مبلغ (تومان)</th>
                  <th>شماره کارت</th>
                  <th>شماره شبا</th>
                  <th>به نام</th>
                  <th>کد پیگیری</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const applicant = `${s.user.profile?.firstName ?? ""} ${s.user.profile?.lastName ?? ""}`.trim() || s.user.mobile
                  return (
                    <tr key={s.id}>
                      <td className="text-center">{toFaDigits(i + 1)}</td>
                      <td>{applicant}</td>
                      <td className="num">{s.user.mobile}</td>
                      <td className="amount">{formatToman(s.amount)}</td>
                      <td className="num">{s.bankCardNumber}</td>
                      <td className="num">{s.bankSheba}</td>
                      <td>{s.bankAccountName}</td>
                      <td className="num">{s.trackingCode}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-center">
                    جمع کل
                  </td>
                  <td className="amount">{formatToman(total)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>

            <p className="mt-4 text-[10px] leading-5 text-slate-400">
              این فهرست صرفاً برای انجام پرداخت خارج از سامانه صادر شده است؛ انتقال وجهی توسط سامانه انجام نمی‌شود.
              پس از واریز، وضعیت هر ردیف باید در پنل مدیریت به «پرداخت‌شده» با کد پیگیری بانکی ثبت شود.
            </p>
          </>
        )}

        <PrintTrigger />
      </div>
    </div>
  )
}
