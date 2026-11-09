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
import { Save, Landmark, ShieldCheck } from "lucide-react"

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
        description="اطلاعات هویتی، مکانی و بانکی شما — اطلاعات بانکی برای درخواست تسویه لازم است (PROFILE-006/007)."
        action={
          <Button onClick={save} disabled={loading}>
            <Save className="ml-1 h-4 w-4" />
            {loading ? "در حال ذخیره…" : "ذخیره تغییرات"}
          </Button>
        }
      />

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
                <label className="text-sm font-medium">کد ملی</label>
                <Input dir="ltr" inputMode="numeric" maxLength={10} placeholder="۱۰ رقم" value={p?.nationalCode ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, nationalCode: e.target.value } })} className="text-left" />
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
                <h2 className="font-semibold">اطلاعات بانکی (اختیاری)</h2>
              </div>
              <p className="rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                ثبت شماره کارت و شبا برای استفاده‌های عمومی پروفایل الزامی نیست؛ اما برای «درخواست تسویه پورسانت» به هر دو به‌همراه نام صاحب حساب نیاز خواهد بود (BR-04/05).
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">شماره کارت ۱۶ رقمی</label>
                <Input dir="ltr" inputMode="numeric" maxLength={16} placeholder="6037xxxxxxxxxxxx" value={p?.cardNumber ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, cardNumber: e.target.value.replace(/\D/g, "") } })} className="text-left font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">شماره شبا</label>
                <Input dir="ltr" placeholder="IR + ۲۴ رقم" value={p?.sheba ?? ""} onChange={(e) => setData({ ...data, profile: { ...p!, sheba: e.target.value } })} className="text-left font-mono" />
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
