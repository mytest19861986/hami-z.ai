"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { CheckCircle2, ShoppingBag, Info, IdCard, UserCheck } from "lucide-react"

interface Plan {
  id: string
  title: string
  price: number
  durationDays: number
  discountPercent: number
  usageLimit: number | null
}

interface ProfileInfo {
  profile: { nationalCode: string | null; firstName: string | null; lastName: string | null } | null
  referral: { referredBy: { name: string } | null } | null
}

// PAY/SELF: خرید طرح فقط برای خودِ کاربر — طرح و کارت به نام خود او ثبت می‌شود
function isProfileComplete(p: ProfileInfo["profile"]): boolean {
  return !!(
    p?.nationalCode &&
    /^\d{10}$/.test(p.nationalCode) &&
    p.firstName &&
    p.firstName.trim().length >= 2 &&
    p.lastName &&
    p.lastName.trim().length >= 2
  )
}

export default function BuyPage() {
  const searchParams = useSearchParams()
  const planIdParam = searchParams.get("planId")

  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null)
  const [planId, setPlanId] = useState(planIdParam ?? "")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ trackingCode: string; message: string } | null>(null)

  useEffect(() => {
    api.get<Plan[]>("/api/v1/public/plans").then(setPlans).catch(() => setPlans([]))
    api.get<ProfileInfo>("/api/v1/user/profile").then(setProfileInfo).catch(() => setProfileInfo(null))
  }, [])

  const selectedPlan = (plans ?? []).find((p) => p.id === planId)
  // PAY/SELF: نام، نام خانوادگی و کد ملی خریدار برای ثبت طرح به نام خودش الزامی است
  const profileComplete = isProfileComplete(profileInfo?.profile)
  const selfName = profileInfo?.profile
    ? `${profileInfo.profile.firstName ?? ""} ${profileInfo.profile.lastName ?? ""}`.trim()
    : null
  const referredByName = profileInfo?.referral?.referredBy?.name ?? null

  async function submitBuy() {
    setLoading(true)
    try {
      const res = await api.post<{ purchase: { trackingCode: string }; message: string }>("/api/v1/user/purchases", {
        planId,
      })
      setDone({ trackingCode: res.purchase.trackingCode, message: res.message })
      toast({ title: "درخواست خرید ثبت شد", description: `کد پیگیری: ${res.purchase.trackingCode}` })
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <h1 className="mt-4 text-xl font-bold">درخواست خرید طرح ثبت شد</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {done.message ||
                "درگاه پرداخت آنلاین متصل نیست؛ درخواست شما ثبت می‌شود و پس از پرداخت طبق هماهنگی و تأیید مدیر، طرح فعال خواهد شد."}
            </p>
            <div className="mt-4 rounded-lg bg-muted/60 px-4 py-3">
              <span className="text-xs text-muted-foreground">کد پیگیری: </span>
              <span className="font-mono font-bold" dir="ltr">{done.trackingCode}</span>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild>
                <Link href="/user/purchases">مشاهده سوابق خرید</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/user">بازگشت به داشبورد</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="خرید طرح عضویت"
        description="خرید طرح فقط به نام خود شما ثبت می‌شود و کارت تخفیف نیز به نام شما صادر خواهد شد."
      />

      {/* PAY/SELF: الزام تکمیل پروفایل (نام + نام خانوادگی + کد ملی) برای خرید به نام خود */}
      {profileInfo && !profileComplete ? (
        <Card className="mb-5 border-amber-300 bg-amber-50">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <IdCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-bold text-amber-900">تکمیل پروفایل برای خرید طرح الزامی است</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  نام، نام خانوادگی و کد ملی (۱۰ رقم) شما برای ثبت طرح و صدور کارت به نام خودتان الزامی است؛
                  بدون آن امکان ثبت درخواست خرید وجود ندارد.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0 border-amber-400 bg-white hover:bg-amber-100">
              <Link href="/user/profile">تکمیل پروفایل</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* انتخاب طرح */}
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <ShoppingBag className="h-5 w-5 text-primary" />
                ۱. انتخاب طرح
              </h2>
              {!plans ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlanId(p.id)}
                      className={`rounded-xl border p-4 text-right transition-all ${planId === p.id ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:border-primary/40"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{p.title}</span>
                        {planId === p.id ? <CheckCircle2 className="h-5 w-5 text-primary" /> : null}
                      </div>
                      <div className="mt-1 text-sm text-primary">{formatToman(p.price)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.discountPercent}٪ تخفیف · {p.usageLimit === null ? "استفاده نامحدود" : `${p.usageLimit} مرتبه`} · {p.durationDays} روز
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* معرف */}
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-1 flex items-center gap-2 font-semibold">
                <UserCheck className="h-5 w-5 text-primary" />
                ۲. معرف (کد رفرال)
              </h2>
              {referredByName ? (
                <p className="text-xs leading-6 text-muted-foreground">
                  حساب شما هنگام ثبت‌نام با کد رفرال «{referredByName}» فعال شده است؛ پس از تأیید این خرید، پورسانت معرفی به‌طور خودکار برای او ثبت می‌شود.
                </p>
              ) : (
                <p className="text-xs leading-6 text-muted-foreground">
                  اگر هنگام ثبت‌نام کد معرفی وارد نکرده‌اید، این مرحله خالی می‌ماند. کد رفرال فقط هنگام ثبت‌نام از طریق لینک دعوت یا فیلد «کد معرف» در صفحه ورود قابل ثبت است و پورسانت معرفی پس از خرید شما برای معرف ثبت می‌شود.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* خلاصه */}
        <div>
          <Card className="sticky top-20">
            <CardContent className="p-6">
              <h2 className="font-semibold">خلاصه خرید</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">طرح</span>
                  <span className="font-medium">{selectedPlan?.title ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">دارنده طرح</span>
                  <span className="font-medium">{selfName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">مبلغ</span>
                  <span className="font-bold text-primary">{selectedPlan ? formatToman(selectedPlan.price) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تخفیف ویزیت</span>
                  <span className="font-medium">{selectedPlan ? `${selectedPlan.discountPercent}٪` : "—"}</span>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                درگاه پرداخت آنلاین متصل نیست؛ درخواست شما ثبت می‌شود و پس از پرداخت طبق هماهنگی و تأیید مدیر، طرح فعال خواهد شد.
              </div>
              <Button
                className="mt-5 w-full"
                size="lg"
                disabled={loading || !planId || !profileComplete}
                onClick={submitBuy}
              >
                {loading ? "در حال ثبت…" : !profileComplete ? "ابتدا پروفایل را تکمیل کنید" : "ثبت درخواست خرید"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
