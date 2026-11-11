import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { PublicHeader, PublicFooter } from "@/components/shared/public-chrome"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BadgePercent, Clock, ShieldCheck, Info } from "lucide-react"
import { formatToman } from "@/lib/format"
import { toFaDigits } from "@/lib/jalali"

export const dynamic = "force-dynamic"

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const plan = await db.discountPlan.findFirst({ where: { id, isActive: true } })
  if (!plan) notFound()

  const features: string[] = plan.features ? JSON.parse(plan.features) : []

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/plans" className="hover:text-foreground">طرح‌ها</Link>
          <span className="text-border">/</span>
          <span className="text-foreground">{plan.title}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="relative overflow-hidden lg:col-span-3">
            <span className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <CardContent className="p-6 pt-7">
              <h1 className="font-display text-2xl font-extrabold">{plan.title}</h1>
              <p className="mt-2 text-muted-foreground">{plan.description}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                  <BadgePercent className="mx-auto h-6 w-6 text-gold-deep" />
                  <div className="font-display mt-2 text-lg font-extrabold tabular-nums">{toFaDigits(plan.discountPercent)}٪</div>
                  <div className="text-xs text-muted-foreground">تخفیف ویزیت</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                  <Clock className="mx-auto h-6 w-6 text-gold-deep" />
                  <div className="font-display mt-2 text-lg font-extrabold tabular-nums">{toFaDigits(plan.durationDays)}</div>
                  <div className="text-xs text-muted-foreground">روز اعتبار</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                  <ShieldCheck className="mx-auto h-6 w-6 text-gold-deep" />
                  <div className="font-display mt-2 text-lg font-extrabold tabular-nums">{plan.usageLimit === null ? "نامحدود" : toFaDigits(plan.usageLimit)}</div>
                  <div className="text-xs text-muted-foreground">مرتبه استفاده</div>
                </div>
              </div>

              {features.length > 0 ? (
                <div className="mt-6">
                  <h2 className="mb-3 font-semibold">مزایا و شرایط</h2>
                  <ul className="space-y-2.5 text-sm">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-fit lg:col-span-2">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">مبلغ عضویت</div>
              <div className="font-display mt-1 text-3xl font-extrabold tabular-nums text-primary">{formatToman(plan.price)}</div>
              <Button asChild className="mt-5 h-11 w-full" size="lg">
                <Link href={`/user/buy?planId=${plan.id}`}>خرید طرح</Link>
              </Button>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs leading-6 text-gold-deep">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  درگاه پرداخت آنلاین متصل نیست؛ درخواست شما ثبت می‌شود و پس از پرداخت طبق هماهنگی و تأیید مدیر، طرح فعال خواهد شد. هیچ پرداخت جعلی «موفق» اعلام نمی‌شود.
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                <li>· خرید طرح فقط به نام خود شما ثبت و کارت به نام شما صادر می‌شود.</li>
                <li>· امکان ثبت معرف (در صورت داشتن همکار معرفی) در زمان خرید.</li>
                <li>· طرح منقضی‌شده یا بدون سهمیه قابل استفاده نیست.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
