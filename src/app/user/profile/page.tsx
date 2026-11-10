"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { ProvinceCitySelect } from "@/components/shared/province-city-select"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { Save, Landmark, ShieldCheck, Gift, Copy, Link2, CheckCircle2, AlertCircle } from "lucide-react"

interface ProfileData {
  mobile: string
  hasPassword: boolean
  roles: { name: string; title: string }[]
  profile: {
    firstName: string | null
    lastName: string | null
    nationalCode: string | null
    gender: string | null
    province: string | null
    city: string | null
    address: string | null
    postalCode: string | null
    cardNumber: string | null
    sheba: string | null
    bankAccountName: string | null
  } | null
  referral?: {
    code: string
    referredCount: number
    referredBy: { name: string } | null
    bankInfoComplete: boolean
  } | null
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<ProfileData>("/api/v1/user/profile").then(setData).catch((e) => toast({ title: "خطا", description: errMessage(e), variant: "destructive" }))
  }, [])

  async function save() {
    if (!data?.profile) return
    setLoading(true)
    try {
      await api.put("/api/v1/user/profile", {
        firstName: data.profile.firstName ?? "",
        lastName: data.profile.lastName ?? "",
        nationalCode: data.profile.nationalCode ?? "",
        gender: data.profile.gender === "MALE" || data.profile.gender === "FEMALE" ? data.profile.gender : "",
        province: data.profile.province ?? "",
        city: data.profile.city ?? "",
        address: data.profile.address ?? "",
        postalCode: data.profile.postalCode ?? "",
        cardNumber: data.profile.cardNumber ?? "",
        sheba: data.profile.sheba ?? "",
        bankAccountName: data.profile.bankAccountName ?? "",
      })
      toast({ title: "ذخیره شد", description: "پروفایل شما با موفقیت به‌روزرسانی شد." })
    } catch (e) {
      toast({ title: "خطا در ذخیره", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "کپی شد", description: label })
    } catch {
      toast({ title: "کپی ناموفق", description: "به‌صورت دستی کپی کنید.", variant: "destructive" })
    }
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const p = data.profile

  return (
    <div>
      <PageHeader
        title="پروفایل کاربری"
        description="اطلاعات هویتی، مکانی و بانکی شما — کد ملی برای خرید طرح و اطلاعات بانکی برای دریافت پورسانت الزامی است."
        action={
          <Button onClick={save} disabled={loading}>
            <Save className="ml-1 h-4 w-4" />
            {loading ? "در حال ذخیره…" : "ذخیره تغییرات"}
          </Button>
        }
      />

      {/* REF-SYS: کارت کد رفرال */}
      {data.referral ? (
        <Card className="mb-5 border-primary/25 bg-gradient-to-l from-primary/5 via-card to-card">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Gift className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <h2 className="font-semibold">کد رفرال شما</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    دوستان را با این کد به حامی‌کارت دعوت کنید؛ با خرید طرح توسط آن‌ها، پورسانت معرفی
                    {data.referral.referredBy ? ` (معرف شما: ${data.referral.referredBy.name})` : ""} برای شما ثبت می‌شود.
                    {data.referral.referredCount > 0 ? ` تاکنون ${data.referral.referredCount} نفر با کد شما ثبت‌نام کرده‌اند.` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="rounded-lg border-2 border-dashed border-primary/30 bg-white px-4 py-2 font-mono text-xl font-bold tracking-[0.3em] text-primary" dir="ltr">
                  {data.referral.code}
                </code>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyText(data.referral!.code, "کد رفرال کپی شد")}>
                    <Copy className="ml-1 h-4 w-4" />
                    کپی کد
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyText(
                        `${window.location.origin}/auth/login?ref=${data.referral!.code}`,
                        "لینک دعوت کپی شد"
                      )
                    }
                  >
                    <Link2 className="ml-1 h-4 w-4" />
                    کپی لینک دعوت
                  </Button>
                </div>
              </div>
            </div>
            {/* REF-SYS: وضعیت اطلاعات بانکی برای دریافت پورسانت */}
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-xs leading-5 ${
                data.referral.bankInfoComplete
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {data.referral.bankInfoComplete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              )}
              {data.referral.bankInfoComplete
                ? "اطلاعات بانکی شما کامل است؛ پورسانت‌های معرفی پس از تأیید مدیر قابل برداشت خواهند بود."
                : "برای دریافت پورسانت معرفی، تکمیل شماره کارت بانکی (۱۶ رقم) و شبا (۲۴ رقم) در بخش اطلاعات بانکی زیر الزامی است."}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-semibold">اطلاعات پایه</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">نام</label>
                <Input value={p?.firstName ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, firstName: e.target.value } })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">نام خانوادگی</label>
                <Input value={p?.lastName ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, lastName: e.target.value } })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">شماره موبایل (تأییدشده)</label>
                <Input dir="ltr" value={data.mobile} disabled className="text-left" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">کد ملی (الزامی برای خرید طرح)</label>
                <Input dir="ltr" inputMode="numeric" maxLength={10} placeholder="۱۰ رقم، بدون نیاز به رقم کنترل" value={p?.nationalCode ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, nationalCode: e.target.value.replace(/\D/g, "") } })} className="text-left" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">جنسیت</label>
              <Select value={p?.gender ?? "NONE"} onValueChange={(v) => setData({ ...data, profile: { ...p!, gender: v === "NONE" ? "" : v } })}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">تعیین‌نشده</SelectItem>
                  <SelectItem value="MALE">مرد</SelectItem>
                  <SelectItem value="FEMALE">زن</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ProvinceCitySelect
              province={p?.province}
              city={p?.city}
              onProvinceChange={(v) => setData({ ...data, profile: { ...p!, province: v } })}
              onCityChange={(v) => setData({ ...data, profile: { ...p!, city: v } })}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نشانی</label>
              <Input value={p?.address ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, address: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">کد پستی</label>
              <Input dir="ltr" inputMode="numeric" maxLength={10} value={p?.postalCode ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, postalCode: e.target.value } })} className="text-left" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">اطلاعات بانکی (الزامی برای دریافت پورسانت)</h2>
              </div>
              <p className="rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                برای دریافت پورسانت معرفی (رفرال) و پورسانت فروش، ثبت شماره کارت ۱۶ رقمی و شبا ۲۴ رقمی الزامی است؛ تا تکمیل این اطلاعات، پورسانت‌های شما تأیید و به کیف پول واریز نمی‌شود.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">شماره کارت ۱۶ رقمی</label>
                <Input dir="ltr" inputMode="numeric" maxLength={16} placeholder="6037xxxxxxxxxxxx" value={p?.cardNumber ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, cardNumber: e.target.value.replace(/\D/g, "") } })} className="text-left font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">شماره شبا (۲۴ رقم، با یا بدون IR)</label>
                <Input dir="ltr" maxLength={26} placeholder="IR + ۲۴ رقم یا فقط ۲۴ رقم" value={p?.sheba ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, sheba: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "") } })} className="text-left font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">نام صاحب حساب</label>
                <Input value={p?.bankAccountName ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, bankAccountName: e.target.value } })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold">نقش‌های شما</h2>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.roles.map((r) => (
                  <span key={r.name} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                    {r.title}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                برای دریافت نقش پزشک، نماینده فروش یا همکار معرفی، از داشبورد درخواست ثبت کنید و پس از تأیید مدیر فعال می‌شود.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
