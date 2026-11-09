"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { faDate } from "@/lib/jalali"
import { Search, CheckCircle2, ClipboardPlus } from "lucide-react"
import { label } from "@/constants/labels"

interface EligibilityResult {
  found: boolean
  message?: string
  holder?: { firstName: string; lastName: string; nationalCode: string }
  memberships?: {
    membershipId: string
    planTitle: string
    planDiscountPercent: number
    endDate: string
    usageLimit: number | null
    usedCount: number
    remaining: number | string
    eligible: boolean
  }[]
}

interface VisitResult {
  visit: {
    id: string
    holder: string
    totalAmount: number
    discountPercent: number
    discountBase: string
    discountAmount: number
    finalAmount: number
    visitDate: string
  }
}

export default function NewVisitPage() {
  const [nationalCode, setNationalCode] = useState("")
  const [mobile, setMobile] = useState("")
  const [result, setResult] = useState<EligibilityResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [selectedMembership, setSelectedMembership] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<VisitResult | null>(null)

  async function check() {
    setChecking(true)
    setResult(null)
    setSelectedMembership("")
    setDone(null)
    try {
      const res = await api.post<EligibilityResult>("/api/v1/doctor/eligibility", {
        ...(nationalCode ? { nationalCode } : {}),
        ...(mobile ? { mobile } : {}),
      })
      setResult(res)
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setChecking(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await api.post<VisitResult>("/api/v1/doctor/visits", {
        membershipId: selectedMembership,
        totalAmount: parseInt(totalAmount.replace(/\D/g, ""), 10),
        note,
      })
      setDone(res)
      toast({ title: "ویزیت ثبت شد", description: "سهمیه دارنده یک‌بار مصرف شد." })
    } catch (e) {
      toast({ title: "خطا در ثبت ویزیت", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    const v = done.visit
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <h1 className="mt-4 text-lg font-bold">ویزیت با موفقیت ثبت شد</h1>
            <p className="mt-1 text-sm text-muted-foreground">دارنده: {v.holder} · {faDate(v.visitDate)}</p>
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between rounded-lg bg-muted/60 px-4 py-2.5">
                <span>مبلغ ویزیت</span>
                <span className="font-bold">{formatToman(v.totalAmount)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-emerald-50 px-4 py-2.5 text-emerald-800">
                <span>تخفیف ({v.discountPercent}٪ — {label(v.discountBase)})</span>
                <span className="font-bold">{formatToman(v.discountAmount)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-primary/10 px-4 py-2.5 text-primary">
                <span>مبلغ پرداختی دارنده</span>
                <span className="font-bold">{formatToman(v.finalAmount)}</span>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => { setDone(null); setResult(null); setNationalCode(""); setMobile(""); setTotalAmount(""); setNote(""); setSelectedMembership("") }}>
                ثبت ویزیت جدید
              </Button>
              <Button asChild variant="outline">
                <Link href="/doctor/visits">تاریخچه ویزیت‌ها</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="استعلام دارنده و ثبت ویزیت" description="دارنده طرح را با کد ملی یا شماره همراه استعلام کنید، سپس ویزیت را ثبت نمایید (SURF-DOCTOR · VISIT-002)." />

      <Card className="mb-5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">کد ملی دارنده طرح</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input dir="ltr" inputMode="numeric" maxLength={10} placeholder="۱۰ رقم" value={nationalCode} onChange={(e) => setNationalCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && (nationalCode.length === 10 || mobile.length === 11) && check()} className="pr-9 text-left" />
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">شماره همراه دارنده</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input dir="ltr" inputMode="numeric" maxLength={11} placeholder="۰۹…" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && (nationalCode.length === 10 || mobile.length === 11) && check()} className="pr-9 text-left" />
              </div>
            </div>
            <Button
              onClick={check}
              disabled={checking || (nationalCode.length !== 10 && mobile.length !== 11)}
              title="حداقل یکی از فیلدها کافی است"
            >
              {checking ? "در حال استعلام…" : "استعلام شرایط"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">یکی از دو فیلد کافی است؛ اگر هر دو را وارد کنید، ابتدا کد ملی بررسی می‌شود.</p>
        </CardContent>
      </Card>

      {result && !result.found ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{result.message ?? "دارنده یافت نشد."}</CardContent></Card>
      ) : null}

      {result && result.found ? (
        <>
          <Card className="mb-5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{result.holder!.firstName} {result.holder!.lastName}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">{result.holder!.nationalCode}</p>
                </div>
                <span className="text-xs text-muted-foreground">هویت حداقلی</span>
              </div>
              <div className="mt-4 space-y-2">
                {(result.memberships ?? []).length === 0 ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{result.message ?? "عضویت فعالی یافت نشد."}</p>
                ) : (
                  (result.memberships ?? []).map((m) => (
                    <button
                      key={m.membershipId}
                      onClick={() => m.eligible && setSelectedMembership(m.membershipId)}
                      disabled={!m.eligible}
                      className={`w-full rounded-xl border p-4 text-right transition-all ${selectedMembership === m.membershipId ? "border-primary bg-primary/5 ring-1 ring-primary/30" : m.eligible ? "hover:border-primary/40" : "opacity-50"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{m.planTitle}</span>
                        <span className={`text-xs ${m.eligible ? "text-emerald-700" : "text-rose-600"}`}>
                          {m.eligible ? "قابل استفاده" : m.usageLimit !== null && m.usedCount >= m.usageLimit ? "سهمیه تکمیل" : "نامعتبر"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        تخفیف طرح {m.planDiscountPercent}٪ · باقی‌مانده: {typeof m.remaining === "number" ? m.remaining : "نامحدود"} · اعتبار تا {faDate(m.endDate)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {selectedMembership ? (
            <Card>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">مبلغ ویزیت (تومان) *</label>
                  <Input dir="ltr" inputMode="numeric" placeholder="مثلاً 350000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="text-left" />
                  {totalAmount ? (
                    <p className="text-xs text-muted-foreground">{formatToman(parseInt(totalAmount.replace(/\D/g, ""), 10) || 0)}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">یادداشت خدمت (اختیاری، محرمانه)</label>
                  <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="در چارچوب حریم خصوصی بیمار" />
                </div>
                <div className="sm:col-span-2">
                  <Button onClick={save} disabled={saving || !totalAmount} size="lg">
                    <ClipboardPlus className="ml-1 h-4 w-4" />
                    {saving ? "در حال ثبت…" : "ثبت نهایی ویزیت"}
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    با ثبت، سهمیه این عضویت دقیقاً یک‌بار مصرف می‌شود؛ ثبت هم‌زمان تکراری مجاز نیست (BR-08 · AC-07).
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
