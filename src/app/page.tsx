import Link from "next/link"
import { db } from "@/lib/db"
import { PublicHeader, PublicFooter } from "@/components/shared/public-chrome"
import { Button } from "@/components/ui/button"
import { BrandMark, Shamseh } from "@/components/shared/brand"
import { ArrowLeft, Stethoscope, MapPin, ShieldCheck, Clock3, HeartHandshake } from "lucide-react"
import { formatToman } from "@/lib/format"
import { toFaDigits, faDate } from "@/lib/jalali"

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

const STEPS = [
  { n: "۰۱", title: "ثبت‌نام", desc: "فقط با شماره موبایل و کد تأیید؛ در چند ثانیه عضو شوید." },
  { n: "۰۲", title: "انتخاب طرح", desc: "طرح مناسب خود یا یکی از اعضای خانواده را تهیه کنید." },
  { n: "۰۳", title: "انتخاب پزشک", desc: "پزشک طرف قرارداد را در شهر خودتان پیدا و مراجعه کنید." },
  { n: "۰۴", title: "دریافت تخفیف", desc: "پزشک ویزیت را ثبت می‌کند و تخفیف طبق طرح شما اعمال می‌شود." },
]

export default async function HomePage() {
  const { plans, doctors, activeMemberships, doctorCount } = await getData()

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      {/* ── هیرو ── */}
      <section className="relative overflow-hidden border-b border-border bg-girih">
        <div className="pointer-events-none absolute -left-24 -top-24 text-primary/10">
          <Shamseh size={420} />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              سامانهٔ عضویت و تخفیف خدمات درمانی
            </p>
            <h1 className="font-display mt-6 text-4xl font-extrabold leading-[1.25] sm:text-5xl">
              سلامتی شما،
              <br />
              با <span className="mark-gold text-primary">تخفیف واقعی</span>
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-8 text-muted-foreground sm:text-base">
              با عضویت در حامی‌کارت، به شبکهٔ پزشکان طرف همکاری در سراسر ایران دسترسی پیدا کنید و در هر مراجعه از تخفیف
              طرح خود بهره‌مند شوید — بدون کاغذبازی، با ثبت شفاف ویزیت و تخفیف.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-7 text-[15px]">
                <Link href="/plans">
                  مشاهدهٔ طرح‌های عضویت
                  <ArrowLeft className="mr-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[15px]">
                <Link href="/doctors">
                  <Stethoscope className="ml-1 h-4 w-4" />
                  پزشکان طرف قرارداد
                </Link>
              </Button>
            </div>
            <dl className="mt-12 flex max-w-lg divide-x divide-x-reverse divide-border">
              <div className="px-5 text-center first:pr-0">
                <dd className="font-display text-3xl font-extrabold tabular-nums text-primary">{toFaDigits(doctorCount)}</dd>
                <dt className="mt-1 text-[11px] text-muted-foreground">پزشک طرف قرارداد</dt>
              </div>
              <div className="px-5 text-center">
                <dd className="font-display text-3xl font-extrabold tabular-nums text-primary">{toFaDigits(activeMemberships)}</dd>
                <dt className="mt-1 text-[11px] text-muted-foreground">عضویت فعال</dt>
              </div>
              <div className="px-5 text-center last:pl-0">
                <dd className="font-display text-3xl font-extrabold tabular-nums text-primary">۳۱</dd>
                <dt className="mt-1 text-[11px] text-muted-foreground">استمان پوشش</dt>
              </div>
            </dl>
          </div>

          {/* کارت عضویت — ماکاپ برند */}
          <div className="relative hidden lg:block">
            <div className="relative mx-auto max-w-sm">
              <div className="pointer-events-none absolute -top-16 -left-14 text-gold/50">
                <Shamseh size={150} />
              </div>
              <div className="relative overflow-hidden rounded-xl bg-sidebar p-6 text-sidebar-foreground shadow-xl shadow-sidebar/25 rotate-[-2deg]">
                <div className="bg-girih-light absolute inset-0" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <BrandMark size={40} />
                      <div className="leading-tight">
                        <div className="font-display text-sm font-bold">کارت حامی‌کارت</div>
                        <div className="mt-0.5 text-[10px] text-sidebar-foreground/60">عضویت فعال خدمات درمانی</div>
                      </div>
                    </div>
                    <span className="rounded-md bg-gold px-2 py-1 text-[10px] font-bold text-sidebar">عضویت</span>
                  </div>
                  <div className="mt-8 flex items-end justify-between border-t border-sidebar-border pt-4">
                    <div>
                      <div className="text-[10px] text-sidebar-foreground/70">دارندهٔ کارت</div>
                      <div className="mt-1 text-sm font-semibold">عضو حامی‌کارت</div>
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-sidebar-foreground/70">تخفیف ویزیت</div>
                      <div className="font-display mt-0.5 text-xl font-extrabold tabular-nums text-gold">۳۰٪</div>
                    </div>
                  </div>
                </div>
              </div>
              {plans[1] ? (
                <div className="relative z-10 mx-auto -mt-3 mr-8 w-fit rotate-[1.5deg] rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
                  <div className="text-xs font-semibold">طرح پیشنهادی: {plans[1].title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-primary">{formatToman(plans[1].price)}</span>
                    <span>· {toFaDigits(plans[1].durationDays)} روز اعتبار</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ── چطور کار می‌کند ── */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gold-deep">مسیر عضویت</p>
              <h2 className="font-display mt-2 text-2xl font-extrabold sm:text-3xl">حامی‌کارت چطور کار می‌کند؟</h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">در چهار قدم ساده تا تخفیف درمانی — بدون فرم کاغذی و مراجعهٔ حضوری.</p>
          </div>
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className={i < STEPS.length - 1 ? "lg:border-l lg:border-border/70 lg:pl-8" : ""}>
                <div className="font-display text-4xl font-extrabold tabular-nums text-gold">{s.n}</div>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── طرح‌ها ── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gold-deep">تعرفه‌ها</p>
            <h2 className="font-display mt-2 text-2xl font-extrabold sm:text-3xl">طرح‌های عضویت</h2>
            <p className="mt-2 text-sm text-muted-foreground">طرح مناسب خود یا عزیزانتان را انتخاب کنید</p>
          </div>
          <Button asChild variant="ghost" className="text-primary hover:text-primary">
            <Link href="/plans">
              همه طرح‌ها
              <ArrowLeft className="mr-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, i) => {
            const features: string[] = plan.features ? JSON.parse(plan.features) : []
            const featured = i === 1
            return (
              <div
                key={plan.id}
                className={
                  featured
                    ? "relative flex flex-col rounded-lg border-2 border-gold/70 bg-card p-6 shadow-lg shadow-gold/10"
                    : "relative flex flex-col rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
                }
              >
                <span className={featured ? "absolute -top-3.5 right-5 rounded-md bg-gold px-3 py-1 text-[11px] font-bold text-sidebar" : "hidden"}>
                  پیشنهاد ما
                </span>
                <div className={featured ? "absolute inset-x-0 top-0 h-1 rounded-t-lg bg-gold" : "absolute inset-x-0 top-0 h-1 rounded-t-lg bg-primary/25"} />
                <h3 className="font-display text-lg font-bold">{plan.title}</h3>
                <p className="mt-1.5 min-h-10 text-sm leading-6 text-muted-foreground">{plan.description}</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-extrabold tabular-nums text-primary">{formatToman(plan.price)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  اعتبار {toFaDigits(plan.durationDays)} روز ·{" "}
                  {plan.usageLimit === null ? "استفاده نامحدود" : `${toFaDigits(plan.usageLimit)} مرتبه استفاده`}
                </div>
                <ul className="mt-5 flex-1 space-y-2.5 border-t border-border/70 pt-5 text-sm">
                  <li className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-gold-deep" />
                    {toFaDigits(plan.discountPercent)}٪ تخفیف ویزیت پزشکان
                  </li>
                  {features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-gold" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={featured ? "default" : "outline"}>
                  <Link href={`/plans/${plan.id}`}>جزئیات و خرید</Link>
                </Button>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── پزشکان ── */}
      {doctors.length > 0 ? (
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gold-deep">شبکهٔ درمانی</p>
                <h2 className="font-display mt-2 text-2xl font-extrabold sm:text-3xl">پزشکان طرف همکاری</h2>
                <p className="mt-2 text-sm text-muted-foreground">نمونه‌ای از شبکهٔ پزشکان حامی‌کارت در سراسر کشور</p>
              </div>
              <Button asChild variant="ghost" className="text-primary hover:text-primary">
                <Link href="/doctors">
                  همه پزشکان
                  <ArrowLeft className="mr-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="divide-y divide-border/80">
              {doctors.map((d) => {
                const name = `${d.user.profile?.firstName ?? ""} ${d.user.profile?.lastName ?? ""}`.trim()
                const initials = `${d.user.profile?.firstName?.[0] ?? "د"}${d.user.profile?.lastName?.[0] ?? ""}`
                return (
                  <div key={d.id} className="flex min-h-[4.5rem] items-center gap-4 py-4 first:pt-2 last:pb-2">
                    <span className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="truncate text-sm font-bold">دکتر {name}</h3>
                        <span className="text-xs text-primary">{d.specialty}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {d.clinicName ? <span>{d.clinicName}</span> : null}
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {d.province} / {d.city}
                        </span>
                      </div>
                    </div>
                    {d.discountPercent ? (
                      <span className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-[11px] font-bold tabular-nums text-secondary-foreground">
                        {toFaDigits(d.discountPercent)}٪ تخفیف اختصاصی
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── CTA پایانی ── */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="bg-girih-light absolute inset-0" />
        <div className="pointer-events-none absolute -left-16 -bottom-20 text-primary-foreground/20">
          <Shamseh size={280} />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
          <HeartHandshake className="mx-auto h-8 w-8 text-gold" />
          <h2 className="font-display mx-auto mt-4 max-w-2xl text-2xl font-extrabold leading-relaxed sm:text-3xl">
            همین حالا عضو حامی‌کارت شوید
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-primary-foreground/80">
            ثبت‌نام رایگان است؛ طرح را هر زمان خواستید به نام خودتان تهیه کنید و کارت تخفیف شما صادر خواهد شد.
          </p>
          <Button asChild size="lg" className="mt-7 h-12 bg-gold px-8 text-[15px] text-sidebar hover:bg-gold/90">
            <Link href="/auth/login">ورود / ثبت‌نام</Link>
          </Button>
          <p className="mt-5 text-[11px] tabular-nums text-primary-foreground/60">آخرین به‌روزرسانی: {faDate(new Date())}</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
