"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { BadgePercent, UserPlus, CheckCircle2, ShoppingBag, Info } from "lucide-react"

interface Plan {
  id: string
  title: string
  price: number
  durationDays: number
  discountPercent: number
  usageLimit: number | null
}

interface Holder {
  id: string
  firstName: string
  lastName: string
  nationalCode: string | null
}

export default function BuyPage() {
  const searchParams = useSearchParams()
  const planIdParam = searchParams.get("planId")

  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [holders, setHolders] = useState<Holder[] | null>(null)
  const [planId, setPlanId] = useState(planIdParam ?? "")
  const [holderId, setHolderId] = useState("")
  const [referrerMobile, setReferrerMobile] = useState("")
  const [newHolderMode, setNewHolderMode] = useState(false)
  const [nh, setNh] = useState({ firstName: "", lastName: "", nationalCode: "", mobile: "" })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ trackingCode: string; message: string } | null>(null)

  useEffect(() => {
    api.get<Plan[]>("/api/v1/public/plans").then(setPlans).catch(() => setPlans([]))
    api.get<Holder[]>("/api/v1/user/holders").then(setHolders).catch(() => setHolders([]))
  }, [])

  const selectedPlan = (plans ?? []).find((p) => p.id === planId)

  async function createHolderAndBuy() {
    setLoading(true)
    try {
      let hid = holderId
      if (newHolderMode) {
        const res = await api.post<{ holder: Holder }>("/api/v1/user/holders", nh)
        hid = res.holder.id
      }
      if (!hid) throw { message: "دارنده طرح را انتخاب یا ثبت کنید." }
      const res = await api.post<{ purchase: { trackingCode: string }; message: string }>("/api/v1/user/purchases", {
        planId,
        holderId: hid,
        referrerMobile: referrerMobile || "",
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
            <h1 className="mt-4 text-xl font-bold">درخواست خرید ثبت شد</h1>
            <p className="mt-2 text-sm text-muted-foreground">{done.message}</p>
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
      <PageHeader title="تهیه طرح عضویت" description="خریدار و دارنده کارت می‌توانند اشخاص متفاوتی باشند (BR-06)." />

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

          {/* دارنده طرح */}
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <BadgePercent className="h-5 w-5 text-primary" />
                ۲. دارنده طرح
              </h2>
              {!newHolderMode ? (
                <div className="space-y-3">
                  {holders && holders.length > 0 ? (
                    <Select value={holderId} onValueChange={setHolderId}>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب دارنده از فهرست" />
                      </SelectTrigger>
                      <SelectContent>
                        {holders.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.firstName} {h.lastName} {h.nationalCode ? `— ${h.nationalCode}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Button variant="outline" className="w-full" onClick={() => setNewHolderMode(true)}>
                    <UserPlus className="ml-1 h-4 w-4" />
                    ثبت دارنده جدید (مثلاً عضو خانواده)
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">نام دارنده *</label>
                      <Input value={nh.firstName} onChange={(e) => setNh({ ...nh, firstName: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">نام خانوادگی *</label>
                      <Input value={nh.lastName} onChange={(e) => setNh({ ...nh, lastName: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">کد ملی دارنده *</label>
                      <Input dir="ltr" inputMode="numeric" maxLength={10} value={nh.nationalCode} onChange={(e) => setNh({ ...nh, nationalCode: e.target.value.replace(/\D/g, "") })} className="text-left" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">موبایل دارنده (اختیاری)</label>
                      <Input dir="ltr" inputMode="tel" value={nh.mobile} onChange={(e) => setNh({ ...nh, mobile: e.target.value })} className="text-left" />
                    </div>
                  </div>
                  {holders && holders.length > 0 ? (
                    <Button variant="ghost" className="w-full" onClick={() => setNewHolderMode(false)}>
                      انتخاب از فهرست دارندگان قبلی
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          {/* معرف */}
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-1 font-semibold">۳. معرف (اختیاری)</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                اگر فردی شما را به حامی‌کارت معرفی کرده و «همکار معرفی» است، شماره موبایل او را وارد کنید تا پورسانت معرفی برایش ثبت شود.
              </p>
              <Input dir="ltr" inputMode="tel" placeholder="09xxxxxxxxx" value={referrerMobile} onChange={(e) => setReferrerMobile(e.target.value)} className="max-w-xs text-left" />
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
                disabled={loading || !planId || (!newHolderMode && !holderId) || (newHolderMode && (!nh.firstName || !nh.lastName || nh.nationalCode.length !== 10))}
                onClick={createHolderAndBuy}
              >
                {loading ? "در حال ثبت…" : "ثبت درخواست خرید"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
