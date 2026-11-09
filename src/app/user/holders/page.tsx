"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { faDate } from "@/lib/jalali"
import { UserPlus, Users } from "lucide-react"

interface Holder {
  id: string
  firstName: string
  lastName: string
  nationalCode: string | null
  mobile: string | null
  activeMemberships: { id: string; planTitle: string; endDate: string }[]
}

export default function HoldersPage() {
  const [items, setItems] = useState<Holder[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ firstName: "", lastName: "", nationalCode: "", mobile: "" })
  const [loading, setLoading] = useState(false)

  function load() {
    api.get<Holder[]>("/api/v1/user/holders").then(setItems).catch(() => setItems([]))
  }

  useEffect(load, [])

  async function submit() {
    setLoading(true)
    try {
      await api.post("/api/v1/user/holders", form)
      toast({ title: "دارنده ثبت شد" })
      setForm({ firstName: "", lastName: "", nationalCode: "", mobile: "" })
      setShowForm(false)
      load()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="دارندگان طرح"
        description="اشخاصی که طرح آن‌ها را شما تهیه یا ثبت کرده‌اید — خریدار و دارنده می‌توانند متفاوت باشند (HOLDER-001)."
        action={
          <Button onClick={() => setShowForm(!showForm)}>
            <UserPlus className="ml-1 h-4 w-4" />
            ثبت دارنده جدید
          </Button>
        }
      />

      {showForm ? (
        <Card className="mb-5">
          <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نام *</label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نام خانوادگی *</label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">کد ملی *</label>
              <Input dir="ltr" inputMode="numeric" maxLength={10} value={form.nationalCode} onChange={(e) => setForm({ ...form, nationalCode: e.target.value.replace(/\D/g, "") })} className="text-left" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">موبایل (اختیاری)</label>
              <Input dir="ltr" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="text-left" />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={submit} disabled={loading || !form.firstName || !form.lastName || form.nationalCode.length !== 10}>
                {loading ? "در حال ثبت…" : "ثبت دارنده"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!items ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState title="دارنده‌ای ثبت نشده است" description="برای تهیه طرح برای خودتان یا عضو خانواده، ابتدا دارنده را ثبت کنید یا هنگام خرید ثبت کنید." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((h) => (
            <Card key={h.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-semibold">{h.firstName} {h.lastName}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{h.nationalCode ?? "بدون کد ملی"}</div>
                  </div>
                </div>
                {h.activeMemberships.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    {h.activeMemberships.map((m) => (
                      <div key={m.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        عضویت فعال «{m.planTitle}» تا {faDate(m.endDate)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">عضویت فعالی ندارد.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
