"use client"

// پروفایل همکار فروش (REF-SYS · SETTLE-002/003) — سه بخش:
// ۱) مشخصات شخص همکار فروش  ۲) اطلاعات حساب بانکی  ۳) کد رفرال قابل کپی
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { ProvinceCitySelect } from "@/components/shared/province-city-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { BankInfoForm } from "@/components/shared/bank-info-form"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { Save, UserRound, Gift, Copy, Link2, CheckCircle2, AlertCircle, Briefcase } from "lucide-react"

interface ProfileData {
  mobile: string
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
  } | null
  referral?: {
    code: string
    referredCount: number
    referredBy: { name: string } | null
    bankInfoComplete: boolean
  } | null
}

interface AgentStatus {
  id: string
  businessName: string | null
  description: string | null
  province: string | null
  city: string | null
  phone: string | null
  status: string
}

export default function AgentProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [agent, setAgent] = useState<AgentStatus | null | "none">(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api
      .get<ProfileData>("/api/v1/user/profile")
      .then(setData)
      .catch((e) => toast({ title: "خطا", description: errMessage(e), variant: "destructive" }))
    api
      .get<AgentStatus | null>("/api/v1/agent/status")
      .then((d) => setAgent(d ?? "none"))
      .catch(() => setAgent("none"))
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
      })
      toast({ title: "ذخیره شد", description: "مشخصات شخصی شما با موفقیت به‌روزرسانی شد." })
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

  if (!data || agent === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const p = data.profile

  return (
    <div>
      <PageHeader
        title="پروفایل همکار فروش"
        description="مشخصات شخصی، اطلاعات حساب بانکی و کد رفرال شما — برای دریافت پورسانت، تکمیل اطلاعات بانکی الزامی است."
      />

      {/* ── بخش ۱: مشخصات شخص همکار فروش ── */}
      <Card className="mb-5">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">مشخصات شخص همکار فروش</h2>
            </div>
            <Button onClick={save} disabled={loading} size="sm">
              <Save className="ml-1 h-4 w-4" />
              {loading ? "در حال ذخیره…" : "ذخیره مشخصات"}
            </Button>
          </div>

          {/* اطلاعات ثبت‌شدهٔ پرونده همکاری (فقط نمایش) */}
          {agent && agent !== "none" ? (
            <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">نام کسب‌وکار:</span>
                <span className="font-medium">{agent.businessName ?? "ثبت نشده"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">وضعیت همکاری:</span>
                <StatusBadge status={agent.status} />
              </div>
              {agent.province ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">محور فعالیت: </span>
                  <span className="font-medium">
                    {agent.province}
                    {agent.city ? ` — ${agent.city}` : ""}
                  </span>
                </div>
              ) : null}
              {agent.phone ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">تلفن کسب‌وکار: </span>
                  <span className="font-medium" dir="ltr">
                    {agent.phone}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نام</label>
              <Input
                value={p?.firstName ?? ""}
                onChange={(e) => setData({ ...data, profile: { ...p!, firstName: e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نام خانوادگی</label>
              <Input
                value={p?.lastName ?? ""}
                onChange={(e) => setData({ ...data, profile: { ...p!, lastName: e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">شماره موبایل (تأییدشده)</label>
              <Input dir="ltr" value={data.mobile} disabled className="text-left" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">کد ملی</label>
              <Input
                dir="ltr"
                inputMode="numeric"
                maxLength={10}
                placeholder="۱۰ رقم"
                value={p?.nationalCode ?? ""}
                onChange={(e) => setData({ ...data, profile: { ...p!, nationalCode: e.target.value.replace(/\D/g, "") } })}
                className="text-left"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">جنسیت</label>
              <Select
                value={p?.gender ?? "NONE"}
                onValueChange={(v) => setData({ ...data, profile: { ...p!, gender: v === "NONE" ? "" : v } })}
              >
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
              onChange={({ province, city }) =>
                setData((d) => (d && d.profile ? { ...d, profile: { ...d.profile, province, city } } : d))
              }
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نشانی</label>
              <Input
                value={p?.address ?? ""}
                onChange={(e) => setData({ ...data, profile: { ...p!, address: e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">کد پستی</label>
              <Input
                dir="ltr"
                inputMode="numeric"
                maxLength={10}
                value={p?.postalCode ?? ""}
                onChange={(e) => setData({ ...data, profile: { ...p!, postalCode: e.target.value } })}
                className="text-left"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── بخش ۳: کد رفرال قابل کپی ── */}
      {data.referral ? (
        <Card className="mb-5 border-primary/25 bg-gradient-to-l from-primary/5 via-card to-card">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Gift className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <h2 className="font-semibold">کد رفرال شما (قابل کپی)</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    مشتریان را با این کد به حامی‌کارت دعوت کنید؛ با ثبت‌نام با کد شما و خرید طرح، پورسانت معرفی به‌طور خودکار برای شما ثبت می‌شود.
                    {data.referral.referredBy ? ` (معرف شما: ${data.referral.referredBy.name})` : ""}
                    {data.referral.referredCount > 0 ? ` تاکنون ${data.referral.referredCount} نفر با کد شما ثبت‌نام کرده‌اند.` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code
                  className="rounded-lg border-2 border-dashed border-primary/30 bg-white px-4 py-2 font-mono text-xl font-bold tracking-[0.3em] text-primary"
                  dir="ltr"
                >
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
                      copyText(`${window.location.origin}/auth/login?ref=${data.referral!.code}`, "لینک دعوت کپی شد")
                    }
                  >
                    <Link2 className="ml-1 h-4 w-4" />
                    کپی لینک دعوت
                  </Button>
                </div>
              </div>
            </div>
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-xs leading-5 ${
                data.referral.bankInfoComplete ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
              }`}
            >
              {data.referral.bankInfoComplete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              )}
              {data.referral.bankInfoComplete
                ? "اطلاعات بانکی شما کامل است؛ پورسانت‌های شما پس از تأیید مدیر قابل برداشت خواهند بود."
                : "برای دریافت پورسانت، تکمیل شماره کارت بانکی (۱۶ رقم) و شبا (۲۴ رقم) در بخش اطلاعات حساب بانکی زیر الزامی است."}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ── بخش ۲: اطلاعات حساب بانکی ── */}
      <div className="max-w-2xl">
        <BankInfoForm />
      </div>
    </div>
  )
}
