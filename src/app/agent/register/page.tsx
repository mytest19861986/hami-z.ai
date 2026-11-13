"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { ProvinceCitySelect } from "@/components/shared/province-city-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { Send } from "lucide-react"

interface AgentStatus {
  businessName: string | null
  description: string | null
  province: string | null
  city: string | null
  phone: string | null
  status: string
  rejectReason: string | null
}

export default function AgentRegisterPage() {
  const [existing, setExisting] = useState<AgentStatus | null | "loading" | "none">("loading")
  const [form, setForm] = useState({ businessName: "", nationalCode: "", description: "", province: "", city: "", phone: "" })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    api
      .get<AgentStatus | null>("/api/v1/agent/status")
      .then((d) => {
        if (!mounted) return
        if (d) {
          setExisting(d)
          setForm((f) => ({ ...f, businessName: d.businessName ?? "", description: d.description ?? "", province: d.province ?? "", city: d.city ?? "", phone: d.phone ?? "" }))
        } else setExisting("none")
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
      await api.post("/api/v1/agent/register", form)
      toast({ title: "درخواست ثبت شد", description: "در انتظار بررسی مدیر؛ مدارک لازم را از صفحه «مدارک همکاری» بارگذاری کنید." })
      setExisting({ ...form, status: "PENDING", rejectReason: null } as AgentStatus)
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (existing === "loading") {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-72 rounded-xl" /></div>
  }

  const submitted = existing !== "none"

  return (
    <div>
      <PageHeader
        title="درخواست همکاری فروش"
        description="پس از تأیید مدیر و تکمیل مدارک، امکان ثبت مشتری و فروش فعال می‌شود (AGENT-006)."
      />
      {submitted ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <StatusBadge status={(existing as AgentStatus).status} />
          <span className="text-sm text-muted-foreground">
            {(existing as AgentStatus).status === "PENDING" ? "در انتظار بررسی مدیر" : (existing as AgentStatus).status === "APPROVED" ? "تأییدشده — امکانات فروش فعال است" : (existing as AgentStatus).rejectReason ?? ""}
          </span>
        </div>
      ) : null}
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">نام کسب‌وکار *</label>
            <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} disabled={submitted} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">کد ملی *</label>
            <Input dir="ltr" inputMode="numeric" maxLength={10} value={form.nationalCode} onChange={(e) => setForm({ ...form, nationalCode: e.target.value.replace(/\D/g, "") })} className="text-left" disabled={submitted} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">تلفن ارتباطی</label>
            <Input dir="ltr" inputMode="tel" placeholder="09xxxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="text-left" disabled={submitted} />
          </div>
          <div className="sm:col-span-2">
            <ProvinceCitySelect province={form.province} city={form.city} onChange={({ province, city }) => setForm((f) => ({ ...f, province, city }))} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">توضیح فعالیت</label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={submitted} />
          </div>
          {!submitted ? (
            <div className="sm:col-span-2">
              <Button onClick={submit} disabled={loading || !form.businessName || !form.province || !form.city}>
                <Send className="ml-1 h-4 w-4" />
                {loading ? "در حال ارسال…" : "ثبت و ارسال درخواست"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
