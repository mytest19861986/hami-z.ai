"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Smartphone, KeyRound, LockKeyhole, Info, ArrowRight, RefreshCw, ShieldCheck, Clock3, FileCheck2, Users } from "lucide-react"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { BrandMark, Shamseh } from "@/components/shared/brand"

type Step = "mobile" | "otp" | "password"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next")
  // REF-SYS: کد معرف از لینک دعوت (?ref=XXXX) به‌صورت خودکار پر می‌شود
  const refParam = searchParams.get("ref") ?? ""

  const [step, setStep] = useState<Step>("mobile")
  const [mobile, setMobile] = useState("")
  const [code, setCode] = useState("")
  const [referralCode, setReferralCode] = useState(refParam.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startCooldown(sec: number) {
    setCooldown(sec)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  async function sendOtp() {
    setLoading(true)
    setDevCode(null)
    try {
      const res = await api.post<{ smsConnected: boolean; devCode: string | null; message: string }>(
        "/api/v1/auth/send-otp",
        { mobile }
      )
      setStep("otp")
      startCooldown(90)
      toast({ title: "کد تأیید ارسال شد", description: res.message })
      if (res.devCode) setDevCode(res.devCode)
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setLoading(true)
    try {
      const res = await api.post<{ roles: string[]; redirect: string; isNew: boolean }>(
        "/api/v1/auth/verify-otp",
        { mobile, code, referralCode: step === "otp" ? referralCode : "" }
      )
      toast({ title: res.isNew ? "ثبت‌نام با موفقیت انجام شد" : "خوش آمدید", description: "در حال انتقال به پنل شما…" })
      router.replace(nextUrl || res.redirect)
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function loginWithPassword() {
    setLoading(true)
    try {
      const res = await api.post<{ redirect: string }>("/api/v1/auth/login", { mobile, password })
      router.replace(nextUrl || res.redirect)
    } catch (e) {
      toast({ title: "خطا در ورود", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* پنل برند */}
      <aside className="bg-brand-navy relative hidden w-[42%] flex-col justify-between overflow-hidden p-10 text-sidebar-foreground lg:flex">
        <div className="bg-girih-light absolute inset-0" />
        <div className="pointer-events-none absolute -left-20 top-1/3 text-sidebar-foreground/15">
          <Shamseh size={340} />
        </div>
        <div className="relative">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark size={44} />
            <span className="font-display text-xl font-bold">حامی‌کارت</span>
          </Link>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-extrabold leading-relaxed">
            تخفیف واقعی،
            <br />
            در هر مراجعه
          </h2>
          <p className="mt-4 text-sm leading-8 text-sidebar-foreground/85">
            با یک حساب حامی‌کارت، طرح دلخواه را تهیه کنید، پزشک طرف قرارداد را پیدا کنید و تخفیف ویزیت به‌صورت شفاف در
            سامانه ثبت می‌شود.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              { icon: <ShieldCheck className="h-4 w-4 text-gold" />, text: "ورود امن با کد یک‌بارمصرف" },
              { icon: <Clock3 className="h-4 w-4 text-gold" />, text: "فعال‌سازی آنی طرح پس از تأیید" },
              { icon: <FileCheck2 className="h-4 w-4 text-gold" />, text: "سابقهٔ شفاف ویزیت‌ها و تخفیف‌ها" },
            ].map((it) => (
              <li key={it.text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent/70">{it.icon}</span>
                <span className="text-sidebar-foreground/90">{it.text}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-10 grid grid-cols-3 gap-3 border-t border-sidebar-border pt-6 text-center">
            <div>
              <dd className="font-display text-lg font-extrabold tabular-nums text-gold">۳۱</dd>
              <dt className="mt-1 text-[10px] text-sidebar-foreground/70">استمان پوشش</dt>
            </div>
            <div className="border-x border-sidebar-border">
              <dd className="font-display text-lg font-extrabold tabular-nums text-gold">+۱۰</dd>
              <dt className="mt-1 text-[10px] text-sidebar-foreground/70">تخصص پزشکی</dt>
            </div>
            <div>
              <dd className="font-display text-lg font-extrabold tabular-nums text-gold">۱۵ تا ۳۰٪</dd>
              <dt className="mt-1 text-[10px] text-sidebar-foreground/70">تخفیف ویزیت</dt>
            </div>
          </dl>
        </div>
        <div className="relative text-[11px] text-sidebar-foreground/60">© حامی‌کارت — نسخهٔ نمایشی</div>
      </aside>

      {/* فرم ورود */}
      <main className="relative flex flex-1 items-center justify-center bg-brand-ice p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-right">
            <div className="flex justify-center lg:hidden">
              <Link href="/" aria-label="حامی‌کارت">
                <BrandMark size={52} className="rounded-2xl shadow-float" />
              </Link>
            </div>
            <h1 className="font-display mt-5 text-2xl font-extrabold lg:mt-0">ورود به حامی‌کارت</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {step === "mobile"
                ? "با شماره موبایل خود وارد شوید یا ثبت‌نام کنید"
                : step === "otp"
                  ? "کد تأیید پیامک‌شده را وارد کنید"
                  : "ورود با رمز عبور"}
            </p>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/95 p-6 shadow-float backdrop-blur-sm sm:p-8">
            {step === "mobile" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">شماره موبایل</label>
                  <div className="relative">
                    <Smartphone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      dir="ltr"
                      inputMode="tel"
                      placeholder="09123456789"
                      maxLength={11}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && mobile && sendOtp()}
                      className="h-11 pr-9 text-left"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">با صفر ۱۱ رقم یا بدون صفر ۱۰ رقم</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">کد معرف (اختیاری)</label>
                  <div className="relative">
                    <Users className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      dir="ltr"
                      placeholder="مثلاً HK4TP2"
                      maxLength={8}
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      className="h-11 pr-9 text-left font-mono tracking-widest"
                    />
                  </div>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    اگر دوستی شما را با کد رفرال به حامی‌کارت دعوت کرده، کد او را وارد کنید تا پس از خرید طرح، پورسانت معرفی برایش ثبت شود.
                  </p>
                </div>
                <Button className="h-11 w-full" disabled={loading || mobile.length < 10} onClick={sendOtp}>
                  {loading ? "در حال ارسال…" : "دریافت کد تأیید"}
                </Button>
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">یا</span>
                  <Separator className="flex-1" />
                </div>
                <Button variant="outline" className="h-11 w-full" onClick={() => setStep("password")}>
                  <LockKeyhole className="ml-1 h-4 w-4" />
                  ورود با رمز عبور
                </Button>
              </div>
            ) : step === "otp" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-muted/70 px-3.5 py-2.5 text-sm">
                  <span dir="ltr" className="font-medium tabular-nums">{mobile}</span>
                  <button className="text-xs font-medium text-primary hover:underline" onClick={() => { setStep("mobile"); setCode("") }}>
                    تغییر شماره
                  </button>
                </div>

                {devCode ? (
                  <div className="flex items-start gap-2 rounded-lg border border-gold/50 bg-gold/10 p-3 text-xs leading-5 text-gold-deep">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      سرویس پیامک واقعی هنوز متصل نشده است. کد تأیید آزمایشی شما:
                      <span className="mx-1 select-all font-mono text-base font-bold tracking-widest" dir="ltr">{devCode}</span>
                      (این کد فقط در محیط توسعه نمایش داده می‌شود.)
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">کد تأیید ۵ رقمی</label>
                  <div className="relative">
                    <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      dir="ltr"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="— — — — —"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && code.length === 5 && verifyOtp()}
                      className="h-11 pr-9 text-center text-lg font-semibold tracking-[0.5em]"
                    />
                  </div>
                </div>
                <Button className="h-11 w-full" disabled={loading || code.length !== 5} onClick={verifyOtp}>
                  {loading ? "در حال بررسی…" : "تأیید و ورود"}
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 w-full text-muted-foreground"
                  disabled={cooldown > 0 || loading}
                  onClick={sendOtp}
                >
                  <RefreshCw className="ml-1 h-4 w-4" />
                  {cooldown > 0 ? `ارسال مجدد کد (${cooldown} ثانیه)` : "ارسال مجدد کد"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">شماره موبایل</label>
                  <Input dir="ltr" inputMode="tel" placeholder="09123456789" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-11 text-left" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">رمز عبور</label>
                  <Input dir="ltr" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && password && loginWithPassword()} className="h-11 text-left" />
                </div>
                <Button className="h-11 w-full" disabled={loading || !mobile || !password} onClick={loginWithPassword}>
                  {loading ? "در حال ورود…" : "ورود"}
                </Button>
                <Button variant="ghost" className="h-10 w-full text-muted-foreground" onClick={() => setStep("mobile")}>
                  <ArrowRight className="ml-1 h-4 w-4" />
                  ورود با کد تأیید
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  ورود با رمز فقط برای حساب‌هایی که رمز تعیین کرده‌اند فعال است. حساب کاربری معمولی با کد تأیید وارد می‌شود.
                </p>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">بازگشت به صفحه اصلی</Link>
            <span className="mx-2">·</span>
            ورود شما به معنای پذیرش
            <Link href="/p/terms" className="mx-1 hover:text-foreground">قوانین</Link>
            است.
          </p>
        </div>
      </main>
    </div>
  )
}
