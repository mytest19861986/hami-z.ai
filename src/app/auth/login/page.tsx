"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { HeartPulse, Smartphone, KeyRound, LockKeyhole, Info, ArrowRight, RefreshCw } from "lucide-react"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"

type Step = "mobile" | "otp" | "password"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next")

  const [step, setStep] = useState<Step>("mobile")
  const [mobile, setMobile] = useState("")
  const [code, setCode] = useState("")
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
        { mobile, code }
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/70 to-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <HeartPulse className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-xl font-bold">ورود به حامی‌کارت</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "mobile" ? "با شماره موبایل خود وارد شوید یا ثبت‌نام کنید" : step === "otp" ? "کد تأیید پیامک‌شده را وارد کنید" : "ورود با رمز عبور"}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6">
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
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && mobile && sendOtp()}
                      className="pr-9 text-left"
                    />
                  </div>
                </div>
                <Button className="w-full" disabled={loading || mobile.length < 10} onClick={sendOtp}>
                  {loading ? "در حال ارسال…" : "دریافت کد تأیید"}
                </Button>
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">یا</span>
                  <Separator className="flex-1" />
                </div>
                <Button variant="outline" className="w-full" onClick={() => setStep("password")}>
                  <LockKeyhole className="ml-1 h-4 w-4" />
                  ورود با رمز عبور
                </Button>
              </div>
            ) : step === "otp" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <span dir="ltr" className="font-medium tabular-nums">{mobile}</span>
                  <button className="text-xs text-primary hover:underline" onClick={() => { setStep("mobile"); setCode("") }}>
                    تغییر شماره
                  </button>
                </div>

                {devCode ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
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
                      className="pr-9 text-center text-lg tracking-[0.5em]"
                    />
                  </div>
                </div>
                <Button className="w-full" disabled={loading || code.length !== 5} onClick={verifyOtp}>
                  {loading ? "در حال بررسی…" : "تأیید و ورود"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
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
                  <Input dir="ltr" inputMode="tel" placeholder="09123456789" value={mobile} onChange={(e) => setMobile(e.target.value)} className="text-left" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">رمز عبور</label>
                  <Input dir="ltr" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && password && loginWithPassword()} className="text-left" />
                </div>
                <Button className="w-full" disabled={loading || !mobile || !password} onClick={loginWithPassword}>
                  {loading ? "در حال ورود…" : "ورود"}
                </Button>
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep("mobile")}>
                  <ArrowRight className="ml-1 h-4 w-4" />
                  ورود با کد تأیید
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  ورود با رمز فقط برای حساب‌هایی که رمز تعیین کرده‌اند فعال است. حساب کاربری معمولی با کد تأیید وارد می‌شود.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">بازگشت به صفحه اصلی</Link>
          <span className="mx-2">·</span>
          ورود شما به معنای پذیرش
          <Link href="/p/terms" className="mx-1 hover:text-foreground">قوانین</Link>
          است.
        </p>
      </div>
    </div>
  )
}
