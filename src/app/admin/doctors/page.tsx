"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { DoctorStatsModal } from "@/components/admin/doctor-stats-modal"
import { DoctorEditModal } from "@/components/admin/doctor-edit-modal"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { toFaDigits } from "@/lib/jalali"
import { Search, ChartColumn, Pencil, XCircle, TriangleAlert, ChevronDown, Star } from "lucide-react"

/* ─── نشان امتیاز پزشک (REVIEW-005) — سطل طلایی ستاره + میانگین + تعداد رأی ─── */
function RatingBadge({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground" title="هنوز نظر تأییدشده‌ای ثبت نشده">
        <Star className="h-3 w-3" />
        بدون امتیاز
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-gradient-to-l from-amber-50 to-yellow-50 px-2.5 py-0.5 shadow-sm"
      title={`میانگین ${toFaDigits(avg)} از ۵ — بر اساس ${toFaDigits(count)} نظر تأییدشده`}
    >
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
      <span className="text-xs font-extrabold text-amber-700">{toFaDigits(avg)}</span>
      <span className="text-[10px] font-medium text-amber-600/80">({toFaDigits(count)} رأی)</span>
    </span>
  )
}

interface DoctorRow {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  mobile: string
  medicalCouncilCode: string
  specialty: string
  clinicName: string | null
  clinicAddress: string | null
  province: string | null
  city: string | null
  clinicPhone: string | null
  bio: string | null
  address?: string | null
  education?: string | null
  referrerDoctor?: string | null
  discountPercent: number | null
  status: string
  rejectReason: string | null
  isPublic: boolean
  avatarUrl?: string | null
  visitsCount: number
  ratingAvg: number | null
  ratingCount: number
  createdAt: string
}

interface DoctorsResponse {
  total: number
  page: number
  totalPages: number
  doctors: DoctorRow[]
}

type ReviewAction = { doctor: DoctorRow; decision: "REJECT" | "SUSPEND" }

export default function AdminDoctorsPage() {
  const [data, setData] = useState<DoctorsResponse | null>(null)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [detail, setDetail] = useState<DoctorRow | null>(null)
  const [reason, setReason] = useState("")
  const [discount, setDiscount] = useState("")
  const [statsDoctor, setStatsDoctor] = useState<DoctorRow | null>(null)
  const [editDoctor, setEditDoctor] = useState<DoctorRow | null>(null)
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const requestKey = JSON.stringify([q, status, page])
  const loading = requestKey !== loadedKey

  function fetchUrl() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    params.set("page", String(page))
    return `/api/v1/admin/doctors?${params.toString()}`
  }

  useEffect(() => {
    let mounted = true
    api
      .get<DoctorsResponse>(fetchUrl())
      .then((d) => {
        if (!mounted) return
        setData(d)
        setLoadedKey(requestKey)
      })
      .catch((e) => {
        if (mounted) toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
        if (mounted) setLoadedKey(requestKey)
      })
    return () => {
      mounted = false
    }
  }, [requestKey])

  function refreshList() {
    api.get<DoctorsResponse>(fetchUrl()).then(setData).catch(() => {})
  }

  async function action(body: Record<string, unknown>, successMsg = "انجام شد") {
    try {
      await api.post("/api/v1/admin/doctors", body)
      toast({ title: successMsg })
      setDetail(null)
      setReason("")
      refreshList()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  // تأیید رد/تعلیق از منوی «عملیات» (دلیل الزامی است)
  async function confirmReviewAction() {
    if (!reviewAction) return
    setActionBusy(true)
    try {
      await action(
        { action: "review", doctorId: reviewAction.doctor.id, decision: reviewAction.decision, reason },
        reviewAction.decision === "REJECT" ? "پزشک رد شد" : "پزشک تعلیق شد"
      )
      setReviewAction(null)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="مدیریت پزشکان" description="بررسی درخواست‌های همکاری، تأیید/رد/تعلیق و تنظیم تخفیف اختصاصی (ADMIN-007..010)" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="نام، کد نظام پزشکی یا مطب…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
        </div>
        <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="PENDING">در انتظار</SelectItem>
            <SelectItem value="APPROVED">تأییدشده</SelectItem>
            <SelectItem value="REJECTED">ردشده</SelectItem>
            <SelectItem value="SUSPENDED">تعلیق‌شده</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} پزشک</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.doctors.map((d) => (
                  <div key={d.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {d.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.avatarUrl} alt={`عکس ${d.name}`} className="h-9 w-9 rounded-full object-cover ring-1 ring-border" />
                        ) : null}
                        <button className="text-sm font-semibold hover:text-primary" onClick={() => { setDetail(d); setDiscount(d.discountPercent ? String(d.discountPercent) : "") }}>
                          دکتر {d.name}
                        </button>
                        {/* امتیاز تأییدشدهٔ بیماران (REVIEW-005) */}
                        <RatingBadge avg={d.ratingAvg} count={d.ratingCount} />
                        <StatusBadge status={d.status} />
                        {d.discountPercent ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{d.discountPercent}٪ اختصاصی</span> : null}
                        {!d.isPublic && d.status === "APPROVED" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">غیرعمومی</span> : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {d.specialty} · {d.clinicName ?? "—"} · {d.province ?? "—"}/{d.city ?? "—"} · کد نظام: <span dir="ltr">{d.medicalCouncilCode}</span> · {toFaDigits(d.visitsCount)} ویزیت
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.status === "PENDING" ? (
                        <Button size="sm" onClick={() => action({ action: "review", doctorId: d.id, decision: "APPROVE" }, "پزشک تأیید شد")}>تأیید</Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => { setDetail(d); setDiscount(d.discountPercent ? String(d.discountPercent) : "") }}>مدیریت</Button>
                      )}

                      {/* منوی عملیات — آمار و بررسی · مشاهده/ویرایش اطلاعات · رد · تعلیق */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" aria-haspopup="menu">
                            عملیات
                            <ChevronDown className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          <DropdownMenuItem onClick={() => setStatsDoctor(d)}>
                            <ChartColumn />
                            آمار و بررسی
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditDoctor(d)}>
                            <Pencil />
                            مشاهده / ویرایش اطلاعات
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={d.status === "REJECTED"}
                            onClick={() => { setReviewAction({ doctor: d, decision: "REJECT" }); setReason("") }}
                          >
                            <XCircle />
                            رد
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-amber-600 focus:text-amber-600 [&_svg]:!text-amber-600"
                            disabled={d.status !== "APPROVED"}
                            onClick={() => { setReviewAction({ doctor: d, decision: "SUSPEND" }); setReason("") }}
                          >
                            <TriangleAlert />
                            تعلیق
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      ) : null}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail ? (
            <>
              <DialogHeader><DialogTitle>دکتر {detail.name}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-xs">
                  <div>تخصص: {detail.specialty}</div>
                  <div>کد نظام: <span dir="ltr">{detail.medicalCouncilCode}</span></div>
                  <div>مطب: {detail.clinicName ?? "—"}</div>
                  <div>تلفن: <span dir="ltr">{detail.clinicPhone ?? "—"}</span></div>
                  <div className="col-span-2">نشانی: {detail.clinicAddress ?? "—"}</div>
                  <div className="col-span-2">موبایل: <span dir="ltr">{detail.mobile}</span></div>
                  {detail.bio ? <div className="col-span-2 leading-5 text-muted-foreground">{detail.bio}</div> : null}
                </div>

                <div>
                  <Label className="mb-1.5 block">اقدام بررسی</Label>
                  <div className="flex flex-wrap gap-2">
                    {detail.status !== "APPROVED" ? <Button size="sm" onClick={() => action({ action: "review", doctorId: detail.id, decision: "APPROVE" }, "تأیید شد")}>تأیید</Button> : null}
                    <Button size="sm" variant="destructive" disabled={reason.trim().length < 3} onClick={() => action({ action: "review", doctorId: detail.id, decision: "REJECT", reason })}>رد</Button>
                    {detail.status === "APPROVED" ? <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => action({ action: "review", doctorId: detail.id, decision: "SUSPEND", reason })}>تعلیق</Button> : null}
                  </div>
                  <Textarea className="mt-2" rows={2} placeholder="دلیل رد/تعلیق (الزامی)" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>

                <div>
                  <Label className="mb-1.5 block">درصد تخفیف اختصاصی (DOC-012 — فقط توسط مدیر)</Label>
                  <div className="flex gap-2">
                    <Input dir="ltr" inputMode="numeric" placeholder="خالی = طبق درصد طرح" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))} className="w-40 text-left" />
                    <Button size="sm" variant="outline" onClick={() => action({ action: "set_discount", doctorId: detail.id, discountPercent: discount ? parseInt(discount, 10) : null }, "تخفیف اختصاصی ذخیره شد")}>
                      ذخیره
                    </Button>
                  </div>
                </div>

                {detail.status === "APPROVED" ? (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-xs">نمایش در دایرکتوری عمومی (DOC-006)</span>
                    <Button size="sm" variant="outline" onClick={() => action({ action: "set_public", doctorId: detail.id, isPublic: !detail.isPublic }, "به‌روزرسانی شد")}>
                      {detail.isPublic ? "غیرفعال‌سازی نمایش" : "فعال‌سازی نمایش"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* عملیات ← آمار و بررسی */}
      <DoctorStatsModal
        doctor={statsDoctor ? { id: statsDoctor.id, name: statsDoctor.name, specialty: statsDoctor.specialty } : null}
        onClose={() => setStatsDoctor(null)}
      />

      {/* عملیات ← مشاهده / ویرایش اطلاعات */}
      <DoctorEditModal doctor={editDoctor} onClose={() => setEditDoctor(null)} onSaved={refreshList} />

      {/* عملیات ← رد / تعلیق با ثبت دلیل */}
      <Dialog open={!!reviewAction} onOpenChange={(o) => !o && setReviewAction(null)}>
        <DialogContent className="max-w-md">
          {reviewAction ? (
            <>
              <DialogHeader>
                <DialogTitle>{reviewAction.decision === "REJECT" ? "رد پزشک" : "تعلیق پزشک"}</DialogTitle>
                <DialogDescription>
                  {reviewAction.decision === "REJECT"
                    ? `همکاری «دکتر ${reviewAction.doctor.name}» رد می‌شود؛ لطفاً دلیل را ثبت کنید.`
                    : `همکاری «دکتر ${reviewAction.doctor.name}» به‌طور موقت تعلیق می‌شود؛ لطفاً دلیل را ثبت کنید.`}
                </DialogDescription>
              </DialogHeader>
              <Textarea rows={3} placeholder="دلیل رد/تعلیق (الزامی)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setReviewAction(null)} disabled={actionBusy}>انصراف</Button>
                <Button
                  variant={reviewAction.decision === "REJECT" ? "destructive" : "default"}
                  disabled={reason.trim().length < 3 || actionBusy}
                  onClick={confirmReviewAction}
                >
                  {actionBusy ? "در حال انجام…" : reviewAction.decision === "REJECT" ? "تأیید رد" : "تأیید تعلیق"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
