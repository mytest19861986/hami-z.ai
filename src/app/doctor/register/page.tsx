"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { ProvinceCitySelect } from "@/components/shared/province-city-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { DoctorAvatarUpload } from "@/components/shared/doctor-avatar-upload"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { SPECIALTIES } from "@/constants/specialties"
import { Send } from "lucide-react"

interface DoctorStatus {
  specialty: string
  medicalCouncilCode: string
  clinicName: string | null
  clinicAddress: string | null
  province: string | null
  city: string | null
  clinicPhone: string | null
  bio: string | null
  avatarUrl: string | null
  status: string
  rejectReason: string | null
}

export default function DoctorRegisterPage() {
  const [existing, setExisting] = useState<DoctorStatus | null | "loading" | "none">("loading")
  const [form, setForm] = useState({
    medicalCouncilCode: "",
    specialty: "",
    clinicName: "",
    clinicAddress: "",
    province: "",
    city: "",
    clinicPhone: "",
    bio: "",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    api
      .get<DoctorStatus | null>("/api/v1/doctor/status")
      .then((d) => {
        if (!mounted) return
        if (d) {
          setExisting(d)
          setForm((f) => ({
            ...f,
            medicalCouncilCode: d.medicalCouncilCode,
            specialty: d.specialty,
            clinicName: d.clinicName ?? "",
            clinicAddress: d.clinicAddress ?? "",
            province: d.province ?? "",
            city: d.city ?? "",
            clinicPhone: d.clinicPhone ?? "",
            bio: d.bio ?? "",
          }))
        } else {
          setExisting("none")
        }
      })
      .catch(() => {
        if (mounted) setExisting("none")
      })
    return () => {
      mounted = false
    }
  }, [])

  async function submit() {
    setLoading(true)
    try {
      await api.post("/api/v1/doctor/register", form)
      toast({ title: "درخواست ثبت شد", description: "درخواست شما در انتظار بررسی مدیر است." })
      setExisting({ ...form, status: "PENDING", rejectReason: null } as DoctorStatus)
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (existing === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const submitted = existing !== "none" && existing !== null

  return (
    <div>
      <PageHeader
        title="درخواست همکاری پزشکی"
        description="اطلاعات حرفه‌ای شما پس از ثبت، توسط مدیر بررسی می‌شود؛ تا تأیید، امکانات عملیاتی فعال نیست (RBAC-004)."
      />

      {submitted ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <StatusBadge status={(existing as DoctorStatus).status} />
          <span className="text-sm text-muted-foreground">
            وضعیت درخواست: {(existing as DoctorStatus).status === "PENDING" ? "در انتظار بررسی مدیر" : (existing as DoctorStatus).status === "APPROVED" ? "تأییدشده — داشبورد عملیاتی فعال است" : (existing as DoctorStatus).rejectReason ?? ""}
          </span>
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-6 p-6">
          {/* عکس پروفایل (DOCTOR-DASH-007) — مستقل از وضعیت درخواست قابل تغییر است */}
          {submitted ? (
            <div className="rounded-xl border bg-muted/40 p-4">
              <h3 className="mb-3 text-sm font-semibold">عکس پروفایل</h3>
              <DoctorAvatarUpload
                avatarUrl={(existing as DoctorStatus).avatarUrl}
                onUpdated={(avatarUrl) => {
                  setExisting({ ...(existing as DoctorStatus), avatarUrl } as DoctorStatus)
                  // هدر پنل هم عکس را از auth/me می‌خواند؛ بدون reload صفحه تازه نمی‌شود
                  window.location.reload()
                }}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">کد نظام پزشکی *</label>
            <Input dir="ltr" inputMode="numeric" value={form.medicalCouncilCode} onChange={(e) => setForm({ ...form, medicalCouncilCode: e.target.value.replace(/\D/g, "") })} className="text-left" disabled={submitted} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">تخصص *</label>
            <Select value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })} disabled={submitted}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب تخصص" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">نام مطب / کلینیک *</label>
            <Input value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} disabled={submitted} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">تلفن مطب</label>
            <Input dir="ltr" inputMode="tel" value={form.clinicPhone} onChange={(e) => setForm({ ...form, clinicPhone: e.target.value })} className="text-left" disabled={submitted} />
          </div>
          <div className="sm:col-span-2">
            <ProvinceCitySelect
              province={form.province}
              city={form.city}
              onChange={({ province, city }) => setForm((f) => ({ ...f, province, city }))}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">نشانی مطب</label>
            <Input value={form.clinicAddress} onChange={(e) => setForm({ ...form, clinicAddress: e.target.value })} disabled={submitted} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">معرفی کوتاه (بیوگرافی)</label>
            <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} disabled={submitted} />
          </div>
          {!submitted ? (
            <div className="sm:col-span-2">
              <Button onClick={submit} disabled={loading || !form.medicalCouncilCode || !form.specialty || !form.clinicName || !form.province || !form.city}>
                <Send className="ml-1 h-4 w-4" />
                {loading ? "در حال ارسال…" : "ثبت و ارسال درخواست"}
              </Button>
            </div>
          ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
