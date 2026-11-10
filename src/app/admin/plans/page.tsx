"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { toFaDigits } from "@/lib/jalali"
import { PlusCircle, Pencil } from "lucide-react"

interface PlanRow {
  id: string
  title: string
  description: string | null
  price: number
  durationDays: number
  discountPercent: number
  usageLimit: number | null
  salesCommissionPercent: number
  referralCommissionPercent: number
  features: string[]
  isActive: boolean
  sortOrder: number
  membershipsCount: number
  purchasesCount: number
  salesCount: number
}

const EMPTY_FORM = {
  title: "",
  description: "",
  price: "",
  durationDays: "365",
  discountPercent: "20",
  usageLimit: "",
  salesCommissionPercent: "10",
  referralCommissionPercent: "5",
  features: "",
  isActive: true,
  sortOrder: "0",
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [grantOpen, setGrantOpen] = useState(false)
  const [grant, setGrant] = useState({ planId: "", firstName: "", lastName: "", nationalCode: "", reason: "", durationDays: "" })
  const [saving, setSaving] = useState(false)

  function load() {
    api.get<PlanRow[]>("/api/v1/admin/plans").then(setPlans).catch((e) => toast({ title: "خطا", description: errMessage(e), variant: "destructive" }))
  }

  useEffect(load, [])

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(p: PlanRow) {
    setEditId(p.id)
    setForm({
      title: p.title,
      description: p.description ?? "",
      price: String(p.price),
      durationDays: String(p.durationDays),
      discountPercent: String(p.discountPercent),
      usageLimit: p.usageLimit === null ? "" : String(p.usageLimit),
      salesCommissionPercent: String(p.salesCommissionPercent),
      referralCommissionPercent: String(p.referralCommissionPercent),
      features: p.features.join("\n"),
      isActive: p.isActive,
      sortOrder: String(p.sortOrder),
    })
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        title: form.title,
        description: form.description,
        price: parseInt(form.price, 10),
        durationDays: parseInt(form.durationDays, 10),
        discountPercent: parseInt(form.discountPercent, 10),
        usageLimit: form.usageLimit ? parseInt(form.usageLimit, 10) : null,
        salesCommissionPercent: parseInt(form.salesCommissionPercent, 10),
        referralCommissionPercent: parseInt(form.referralCommissionPercent, 10),
        features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
        isActive: form.isActive,
        sortOrder: parseInt(form.sortOrder || "0", 10),
        ...(editId ? { id: editId } : {}),
      }
      if (editId) await api.put("/api/v1/admin/plans", body)
      else await api.post("/api/v1/admin/plans", body)
      toast({ title: "طرح ذخیره شد" })
      setOpen(false)
      load()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function submitGrant() {
    setSaving(true)
    try {
      await api.patch("/api/v1/admin/plans", {
        action: "grant",
        planId: grant.planId,
        firstName: grant.firstName,
        lastName: grant.lastName,
        nationalCode: grant.nationalCode,
        reason: grant.reason,
        ...(grant.durationDays ? { durationDays: parseInt(grant.durationDays, 10) } : {}),
      })
      toast({ title: "طرح اعطا شد", description: "عضویت برای دارنده ایجاد شد." })
      setGrantOpen(false)
      setGrant({ planId: "", firstName: "", lastName: "", nationalCode: "", reason: "", durationDays: "" })
      load()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="مدیریت طرح‌ها"
        description="تعریف طرح، درصد پورسانت‌ها و اعطای مدیریتی (ADMIN-012..014 · PLAN-001..013)"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setGrant({ planId: plans?.[0]?.id ?? "", firstName: "", lastName: "", nationalCode: "", reason: "", durationDays: "" }); setGrantOpen(true) }}>
              اعطای مدیریتی طرح
            </Button>
            <Button onClick={openCreate}><PlusCircle className="ml-1 h-4 w-4" />طرح جدید</Button>
          </div>
        }
      />

      {!plans ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{p.title}</h3>
                      <StatusBadge status={p.isActive ? "ACTIVE" : "EXPIRED"} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.description ?? "—"}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <div className="text-muted-foreground">قیمت</div>
                    <div className="mt-0.5 font-bold">{formatToman(p.price)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <div className="text-muted-foreground">تخفیف</div>
                    <div className="mt-0.5 font-bold">{p.discountPercent}٪ / {p.durationDays} روز</div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <div className="text-muted-foreground">سقف استفاده</div>
                    <div className="mt-0.5 font-bold">{p.usageLimit === null ? "نامحدود" : toFaDigits(p.usageLimit)}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                    <div className="text-emerald-700">پورسانت همکار فروش از این طرح</div>
                    <div className="mt-0.5 font-bold">{p.salesCommissionPercent}٪</div>
                  </div>
                  <div className="rounded-lg bg-violet-50 p-2 text-violet-800">
                    <div className="text-violet-700">پورسانت معرفی کاربر از این طرح (۰ = تنظیم سراسری)</div>
                    <div className="mt-0.5 font-bold">{p.referralCommissionPercent}٪</div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <div className="text-muted-foreground">عضویت‌ها</div>
                    <div className="mt-0.5 font-bold">{toFaDigits(p.membershipsCount)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "ویرایش طرح" : "طرح جدید"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>عنوان *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>قیمت (تومان) *</Label><Input dir="ltr" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
            <div className="space-y-1.5"><Label>مدت اعتبار (روز) *</Label><Input dir="ltr" inputMode="numeric" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
            <div className="space-y-1.5"><Label>درصد تخفیف ویزیت (۱–۹۰) *</Label><Input dir="ltr" inputMode="numeric" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
            <div className="space-y-1.5"><Label>سقف استفاده (خالی = نامحدود)</Label><Input dir="ltr" inputMode="numeric" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
            <div className="space-y-1.5"><Label>پورسانت همکار فروش از این طرح (٪ — ۰ تا ۵۰)</Label><Input dir="ltr" inputMode="numeric" value={form.salesCommissionPercent} onChange={(e) => setForm({ ...form, salesCommissionPercent: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
            <div className="space-y-1.5"><Label>پورسانت معرفی کاربر از این طرح (٪ — ۰ تا ۵۰، صفر یعنی از تنظیم سراسری پیروی کند)</Label><Input dir="ltr" inputMode="numeric" value={form.referralCommissionPercent} onChange={(e) => setForm({ ...form, referralCommissionPercent: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
            <div className="space-y-1.5"><Label>ترتیب نمایش</Label><Input dir="ltr" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>توضیح</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>مزایا (هر خط یک مورد)</Label><Textarea rows={3} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <span className="text-sm">طرح فعال باشد (قابل خرید/فروش)</span>
            </div>
            <div className="sm:col-span-2">
              <Button onClick={save} disabled={saving || !form.title || !form.price || !form.durationDays || !form.discountPercent}>
                {saving ? "در حال ذخیره…" : "ذخیره طرح"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>اعطای مدیریتی طرح (ADMIN-014)</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>طرح *</Label>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm" value={grant.planId} onChange={(e) => setGrant({ ...grant, planId: e.target.value })}>
                <option value="">انتخاب طرح…</option>
                {(plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.title} — {formatToman(p.price)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>نام دارنده *</Label><Input value={grant.firstName} onChange={(e) => setGrant({ ...grant, firstName: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>نام خانوادگی *</Label><Input value={grant.lastName} onChange={(e) => setGrant({ ...grant, lastName: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>کد ملی *</Label><Input dir="ltr" inputMode="numeric" maxLength={10} value={grant.nationalCode} onChange={(e) => setGrant({ ...grant, nationalCode: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
              <div className="space-y-1.5"><Label>اعتبار (روز — خالی = طبق طرح)</Label><Input dir="ltr" inputMode="numeric" value={grant.durationDays} onChange={(e) => setGrant({ ...grant, durationDays: e.target.value.replace(/\D/g, "") })} className="text-left" /></div>
            </div>
            <div className="space-y-1.5"><Label>دلیل اعطا (الزامی و قابل ممیزی) *</Label><Textarea rows={2} value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} /></div>
            <Button onClick={submitGrant} disabled={saving || !grant.planId || !grant.firstName || !grant.lastName || grant.nationalCode.length !== 10 || grant.reason.trim().length < 3}>
              {saving ? "در حال اعطا…" : "اعطای طرح"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
