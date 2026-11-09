import Link from "next/link"
import { db } from "@/lib/db"
import { PublicHeader, PublicFooter } from "@/components/shared/public-chrome"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HeartPulse, ShieldCheck, Stethoscope, Users, BadgePercent, MapPin, ArrowLeft, Wallet, Sparkles } from "lucide-react"
import { formatToman } from "@/lib/format"
import { faDate } from "@/lib/jalali"

export const dynamic = "force-dynamic"

async function getData() {
  const now = new Date()
  const [plans, doctors, activeMemberships, doctorCount] = await Promise.all([
    db.discountPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 3 }),
    db.doctor.findMany({
      where: { status: "APPROVED", isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
    }),
    db.membership.count({ where: { status: "ACTIVE", endDate: { gte: now } } }),
    db.doctor.count({ where: { status: "APPROVED", isPublic: true } }),
  ])
  return { plans, doctors, activeMemberships, doctorCount }
}

export default async function HomePage() {
  const { plans, doctors, activeMemberships, doctorCount } = await getData()

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      {/* هیرو */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-emerald-50/80 via-background to-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              سامانه عضویت و تخفیف خدمات درمانی
            </div>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
              سلامتی شما،
              <span className="text-primary"> با تخفیف واقعی</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              با عضویت در حامی‌کارت، به شبکه پزشکان طرف همکاری در سراسر ایران دسترسی پیدا کنید و در هر مراجعه از تخفیف طرح خود بهره‌مند شوید — بدون کاغذبازی، با ثبت شفاف ویزیت و تخفیف.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/plans">
                  مشاهده طرح‌های عضویت
                  <ArrowLeft className="mr-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/doctors">
                  <Stethoscope className="ml-1 h-4 w-4" />
                  پزشکان طرف قرارداد
                </Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              <div className="rounded-xl border bg-card p-3 text-center">
                <dt className="text-xs text-muted-foreground">پزشک طرف قرارداد</dt>
                <dd className="mt-1 text-xl font-bold text-primary">{doctorCount}</dd>
              </div>
              <div className="rounded-xl border bg-card p-3 text-center">
                <dt className="text-xs text-muted-foreground">عضویت فعال</dt>
                <dd className="mt-1 text-xl font-bold text-primary">{activeMemberships}</dd>
              </div>
              <div className="rounded-xl border bg-card p-3 text-center">
                <dt className="text-xs text-muted-foreground">پوشش سراسری</dt>
                <dd className="mt-1 text-xl font-bold text-primary">۳۱ استان</dd>
              </div>
            </dl>
          </div>
          <div className="hidden lg:block">
            <div className="relative">
              <div className="rounded-3xl border bg-card p-6 shadow-lg">
                <div className="flex items-center gap-3 border-b pb-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <HeartPulse className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="font-bold">کارت حامی‌کارت</div>
                    <div className="text-xs text-muted-foreground">تخفیف واقعی خدمات درمانی</div>
                  </div>
                </div>
                <div className="space-y-3 pt-4">
                  {plans.slice(0, 3).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold">{p.title}</div>
                        <div className="text-xs text-muted-foreground">{p.discountPercent}٪ تخفیف ویزیت</div>
                      </div>
                      <div className="text-sm font-bold text-primary">{formatToman(p.price)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* طرح‌ها */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">طرح‌های عضویت</h2>
            <p className="mt-1 text-sm text-muted-foreground">طرح مناسب خود یا عزیزانتان را انتخاب کنید</p>
          </div>
          <Button asChild variant="ghost" className="text-primary">
            <Link href="/plans">
              همه طرح‌ها
              <ArrowLeft className="mr-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan, i) => {
            const features: string[] = plan.features ? JSON.parse(plan.features) : []
            return (
              <Card key={plan.id} className={i === 1 ? "border-primary shadow-md ring-1 ring-primary/20" : ""}>
                <CardContent className="p-6">
                  {i === 1 ? (
                    <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      پیشنهاد ما
                    </span>
                  ) : null}
                  <h3 className="text-lg font-bold">{plan.title}</h3>
                  <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4 text-2xl font-extrabold text-primary">{formatToman(plan.price)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    اعتبار {plan.durationDays} روز · {plan.usageLimit === null ? "استفاده نامحدود" : `${plan.usageLimit} مرتبه استفاده`}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <BadgePercent className="h-4 w-4 text-primary shrink-0" />
                      {plan.discountPercent}٪ تخفیف ویزیت پزشکان طرف قرارداد
                    </li>
                    {features.slice(0, 3).map((f) => (
                      <li key={f} className="flex items-center gap-2 text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-5 w-full" variant={i === 1 ? "default" : "outline"}>
                    <Link href={`/plans/${plan.id}`}>جزئیات و خرید</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* چطور کار می‌کند */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-2 text-center text-2xl font-bold">حامی‌کارت چطور کار می‌کند؟</h2>
          <p className="mb-10 text-center text-sm text-muted-foreground">در چهار قدم ساده تا تخفیف درمانی</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Users className="h-6 w-6" />, title: "۱. ثبت‌نام", desc: "فقط با شماره موبایل و کد تأیید، در چند ثانیه عضو شوید." },
              { icon: <Wallet className="h-6 w-6" />, title: "۲. انتخاب طرح", desc: "طرح مناسب خود یا یکی از اعضای خانواده را تهیه کنید." },
              { icon: <Stethoscope className="h-6 w-6" />, title: "۳. انتخاب پزشک", desc: "پزشک طرف قرارداد را در شهر خودتان پیدا و مراجعه کنید." },
              { icon: <BadgePercent className="h-6 w-6" />, title: "۴. دریافت تخفیف", desc: "پزشک ویزیت را ثبت می‌کند و تخفیف طبق طرح شما اعمال می‌شود." },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border p-5 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {s.icon}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* پزشکان نمونه */}
      {doctors.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">پزشکان طرف همکاری</h2>
              <p className="mt-1 text-sm text-muted-foreground">نمونه‌ای از شبکه پزشکان حامی‌کارت</p>
            </div>
            <Button asChild variant="ghost" className="text-primary">
              <Link href="/doctors">
                همه پزشکان
                <ArrowLeft className="mr-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">
                        {d.user.profile?.firstName ?? ""} {d.user.profile?.lastName ?? ""}
                      </h3>
                      <div className="mt-0.5 text-sm text-primary">{d.specialty}</div>
                    </div>
                    {d.discountPercent ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {d.discountPercent}٪ تخفیف اختصاصی
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {d.clinicName ? <div>{d.clinicName}</div> : null}
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {d.province} / {d.city}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* CTA پایانی */}
      <section className="border-t bg-gradient-to-b from-background to-emerald-50/60">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold">همین حالا عضو حامی‌کارت شوید</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            ثبت‌نام رایگان است؛ طرح را هر زمان خواستید تهیه کنید. خریدار و دارنده کارت می‌توانند افراد متفاوتی باشند.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/auth/login">ورود / ثبت‌نام</Link>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">آخرین به‌روزرسانی: {faDate(new Date())}</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
