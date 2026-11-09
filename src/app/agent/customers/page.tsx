"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Pagination } from "@/components/shared/pagination"
import { ProvinceCitySelect } from "@/components/shared/province-city-select"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { faDate } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { UserPlus, Search } from "lucide-react"

interface Customer {
  id: string
  holder: string
  nationalCode: string | null
  mobile: string | null
  planTitle: string
  planPrice: number
  status: string
  cardNumber: string | null
  rejectReason: string | null
  returnReason: string | null
  paymentAmount: number | null
  paymentTrackingCode: string | null
  createdAt: string
  deliveredAt: string | null
  finalizedAt: string | null
}

interface CustomersResponse {
  total: number
  page: number
  totalPages: number
  customers: Customer[]
}

interface Plan {
  id: string
  title: string
  price: number
}

export default function AgentCustomersPage() {
  const [data, setData] = useState<CustomersResponse | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ firstName: "", lastName: "", nationalCode: "", mobile: "", planId: "", address: "", postalCode: "" })
  const [saving, setSaving] = useState(false)
  const [loadedKey, setLoadedKey] = useState("")

  const requestKey = JSON.stringify([q, status, page])
  const loading = requestKey !== loadedKey

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    params.set("page", String(page))
    api
      .get<CustomersResponse>(`/api/v1/agent/customers?${params.toString()}`)
      .then((d) => {
        if (!mounted) return
        setData(d)
        setLoadedKey(requestKey)
      })
      .catch((e) => {
        if (!mounted) return
        toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
        setLoadedKey(requestKey)
      })
    return () => {
      mounted = false
    }
  }, [requestKey])

  useEffect(() => {
    api.get<Plan[]>("/api/v1/public/plans").then(setPlans).catch(() => {})
  }, [])

  async function submit() {
    setSaving(true)
    try {
      const res = await api.post<{ message: string }>("/api/v1/agent/customers", form)
      toast({ title: "پرونده مشتری ثبت شد", description: res.message })
      setOpen(false)
      setForm({ firstName: "", lastName: "", nationalCode: "", mobile: "", planId: "", address: "", postalCode: "" })
      const params = new URLSearchParams()
      if (q) params.set("q", q)
      if (status) params.set("status", status)
      params.set("page", "1")
      api.get<CustomersResponse>(`/api/v1/agent/customers?${params.toString()}`).then(setData).catch(() => {})
      setPage(1)
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="مشتریان و فروش"
        description="ثبت مشتری به‌تنهایی فروش قطعی نیست؛ پس از بررسی مدیر و تکمیل مراحل کارت، فروش نهایی و پورسانت ثبت می‌شود (BR-11/12)."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="ml-1 h-4 w-4" />ثبت مشتری جدید</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>ثبت مشتری جدید</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">نام مشتری *</label>
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
                  <label className="text-sm font-medium">موبایل</label>
                  <Input dir="ltr" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="text-left" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">طرح *</label>
                  <Select value={form.planId} onValueChange={(v) => setForm({ ...form, planId: v })}>
                    <SelectTrigger><SelectValue placeholder="انتخاب طرح" /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.title} — {formatToman(p.price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">نشانی ارسال کارت *</label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">کد پستی</label>
                  <Input dir="ltr" inputMode="numeric" maxLength={10} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "") })} className="text-left" />
                </div>
                <div className="flex items-end">
                  <Button onClick={submit} disabled={saving || !form.firstName || !form.lastName || form.nationalCode.length !== 10 || !form.planId || !form.address} className="w-full">
                    {saving ? "در حال ثبت…" : "ثبت پرونده مشتری"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="جست‌وجو: نام، موبایل، کد ملی…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
        </div>
        <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {["PENDING_REVIEW", "APPROVED", "CARD_ISSUED", "SENT", "DELIVERED", "PAYMENT_REGISTERED", "FINALIZED", "REJECTED", "RETURNED"].map((s) => (
              <SelectItem key={s} value={s}>{label(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data && data.customers.length === 0 ? (
        <EmptyState title="مشتری‌ای ثبت نشده است" description="اولین مشتری خود را ثبت کنید." />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} پرونده</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.customers.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{c.holder}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.planTitle} · {formatToman(c.planPrice)} · ثبت {faDate(c.createdAt)}
                        {c.cardNumber ? ` · کارت: ${c.cardNumber}` : ""}
                      </div>
                      {c.rejectReason ? <div className="mt-1 text-xs text-rose-600">رد: {c.rejectReason}</div> : null}
                      {c.returnReason ? <div className="mt-1 text-xs text-rose-600">مرجوعی: {c.returnReason}</div> : null}
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-left">
                      {c.finalizedAt ? `نهایی‌شده: ${faDate(c.finalizedAt)}` : c.deliveredAt ? `تحویل: ${faDate(c.deliveredAt)}` : "در جریان بررسی"}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      ) : null}
    </div>
  )
}
