import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { PublicHeader, PublicFooter } from "@/components/shared/public-chrome"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BadgePercent, Clock, ShieldCheck, Info } from "lucide-react"
import { formatToman } from "@/lib/format"

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
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/plans" className="hover:text-foreground">طرح‌ها</Link>
          <span className="mx-2">/</span>
          <span>{plan.title}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="p-6">
              <h1 className="text-2xl font-bold">{plan.title}</h1>
              <p className="mt-2 text-muted-foreground">{plan.description}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/60 p-4 text-center">
                  <BadgePercent className="mx-auto h-6 w-6 text-primary" />
                  <div className="mt-2 text-lg font-bold">{plan.discountPercent}٪</div>
                  <div className="text-xs text-muted-foreground">تخفیف ویزیت</div>
                </div>
                <div className="rounded-xl bg-muted/60 p-4 text-center">
                  <Clock className="mx-auto h-6 w-6 text-primary" />
                  <div className="mt-2 text-lg font-bold">{plan.durationDays}</div>
                  <div className="text-xs text-muted-foreground">روز اعتبار</div>
                </div>
                <div className="rounded-xl bg-muted/60 p-4 text-center">
                  <ShieldCheck className="mx-auto h-6 w-6 text-primary" />
                  <div className="mt-2 text-lg font-bold">{plan.usageLimit === null ? "نامحدود" : plan.usageLimit}</div>
                  <div className="text-xs text-muted-foreground">مرتبه استفاده</div>
                </div>
              </div>

              {features.length > 0 ? (
                <div className="mt-6">
                  <h2 className="mb-3 font-semibold">مزایا و شرایط</h2>
                  <ul className="space-y-2 text-sm">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 h-fit">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">مبلغ عضویت</div>
              <div className="mt-1 text-3xl font-extrabold text-primary">{formatToman(plan.price)}</div>
              <Button asChild className="mt-5 w-full" size="lg">
                <Link href={`/user/buy?planId=${plan.id}`}>تهیه این طرح</Link>
              </Button>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  درگاه پرداخت آنلاین هنوز متصل نشده است. خرید شما ثبت می‌شود و پس از پرداخت طبق هماهنگی و تأیید مدیر، طرح فعال خواهد شد. هیچ پرداخت جعلی «موفق» اعلام نمی‌شود.
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                <li>· خریدار و دارنده کارت می‌توانند افراد متفاوتی باشند.</li>
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
