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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { AgentDetailsModal } from "@/components/admin/agent-details-modal"
import { AgentEditModal } from "@/components/admin/agent-edit-modal"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { faDate } from "@/lib/jalali"
import { toFaDigits } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { Search, ChevronDown, Pencil, Eye, XCircle, TriangleAlert, FileText } from "lucide-react"

interface AgentDoc {
  id: string
  docType: string
  fileName: string
  filePath: string
  status: string
  rejectReason: string | null
}

interface AgentRow {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  mobile: string
  businessName: string | null
  province: string | null
  city: string | null
  phone: string | null
  status: string
  rejectReason: string | null
  documents: AgentDoc[]
  customersCount: number
  createdAt: string
}

interface AgentsResponse {
  total: number
  page: number
  totalPages: number
  agents: AgentRow[]
}

type ReviewAction = { agent: AgentRow; decision: "REJECT" | "SUSPEND" }

export default function AdminAgentsPage() {
  const [data, setData] = useState<AgentsResponse | null>(null)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [detail, setDetail] = useState<AgentRow | null>(null)
  const [reason, setReason] = useState("")
  const [detailsAgent, setDetailsAgent] = useState<AgentRow | null>(null)
  const [editAgent, setEditAgent] = useState<AgentRow | null>(null)
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  // پیش‌نمایش مدرک نماینده (عکس داخل مودال، PDF در تب جدید)
  const [previewDoc, setPreviewDoc] = useState<AgentDoc | null>(null)

  const requestKey = JSON.stringify([q, status, page])
  const loading = requestKey !== loadedKey

  function fetchUrl() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status) params.set("status", status)
    params.set("page", String(page))
    return `/api/v1/admin/agents?${params.toString()}`
  }

  useEffect(() => {
    let mounted = true
    api
      .get<AgentsResponse>(fetchUrl())
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
    api
      .get<AgentsResponse>(fetchUrl())
      .then((d) => {
        setData(d)
        if (detail) {
          const updated = d.agents.find((a) => a.id === detail.id)
          if (updated) setDetail(updated)
        }
      })
      .catch(() => {})
  }

  async function action(body: Record<string, unknown>, successMsg = "انجام شد") {
    try {
      await api.post("/api/v1/admin/agents", body)
      toast({ title: successMsg })
      refreshList()
      setReason("")
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  // بازکردن دیالوگ رد/تعلیق (از منوی «عملیات» یا فوتر مودال جزئیات)
  function openReview(agentId: string, decision: "REJECT" | "SUSPEND") {
    const row = data?.agents.find((a) => a.id === agentId) ?? null
    setDetailsAgent(null)
    setReason("")
    if (row) setReviewAction({ agent: row, decision })
  }

  // تأیید رد/تعلیق از منوی «عملیات» (دلیل الزامی است)
  async function confirmReviewAction() {
    if (!reviewAction) return
    setActionBusy(true)
    try {
      await action(
        { action: "review_agent", agentId: reviewAction.agent.id, decision: reviewAction.decision, reason },
        reviewAction.decision === "REJECT" ? "نماینده رد شد" : "نماینده تعلیق شد"
      )
      setReviewAction(null)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="مدیریت نمایندگان فروش" description="بررسی درخواست‌ها، مدارک و وضعیت نمایندگان (ADMIN-007..011)" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="نام، موبایل یا کسب‌وکار…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
        </div>
        <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="PENDING">در انتظار</SelectItem>
            <SelectItem value="UNDER_REVIEW">در حال بررسی</SelectItem>
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
          <p className="mb-3 text-sm text-muted-foreground">{data.total} نماینده</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.agents.map((a) => (
                  <div key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button className="text-sm font-semibold hover:text-primary" onClick={() => setDetail(a)}>
                          {a.name} {a.businessName ? `— ${a.businessName}` : ""}
                        </button>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span dir="ltr">{a.mobile}</span> · {a.province ?? "—"}/{a.city ?? "—"} · {toFaDigits(a.customersCount)} مشتری · {toFaDigits(a.documents.length)} مدرک
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDetail(a)}>بررسی</Button>

                      {/* منوی عملیات — مشاهده/ویرایش · مشاهده جزئیات · رد · تعلیق */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" aria-haspopup="menu">
                            عملیات
                            <ChevronDown className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          <DropdownMenuItem onClick={() => setEditAgent(a)}>
                            <Pencil />
                            مشاهده / ویرایش اطلاعات
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDetailsAgent(a)}>
                            <Eye />
                            مشاهده جزئیات
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={a.status === "REJECTED"}
                            onClick={() => openReview(a.id, "REJECT")}
                          >
                            <XCircle />
                            رد
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-amber-600 focus:text-amber-600 [&_svg]:!text-amber-600"
                            disabled={a.status !== "APPROVED"}
                            onClick={() => openReview(a.id, "SUSPEND")}
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
              <DialogHeader><DialogTitle>{detail.name} — {detail.businessName ?? "بدون نام کسب‌وکار"}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-xs">
                  <div>موبایل: <span dir="ltr">{detail.mobile}</span></div>
                  <div>تلفن: <span dir="ltr">{detail.phone ?? "—"}</span></div>
                  <div>منطقه: {detail.province ?? "—"}/{detail.city ?? "—"}</div>
                  <div>مشتریان: {toFaDigits(detail.customersCount)}</div>
                  <div className="col-span-2">ثبت درخواست: {faDate(detail.createdAt)}</div>
                </div>

                <div>
                  <div className="mb-2 font-semibold">مدارک (SEC-014: دسترسی فقط برای بررسی‌کنندگان مجاز)</div>
                  <div className="space-y-2">
                    {detail.documents.length === 0 ? (
                      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">نماینده هنوز مدرکی بارگذاری نکرده است.</p>
                    ) : (
                      detail.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{label(doc.docType)}</span>
                              <StatusBadge status={doc.status} />
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{doc.fileName}</div>
                            {doc.rejectReason ? <div className="mt-0.5 text-xs text-rose-600">دلیل رد: {doc.rejectReason}</div> : null}
                          </div>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => setPreviewDoc(doc)}>
                              <Eye className="ml-1 h-3.5 w-3.5" />
                              مشاهده
                            </Button>
                            {doc.status === "PENDING" ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => action({ action: "review_document", documentId: doc.id, decision: "APPROVE" }, "مدرک تأیید شد")}>تأیید</Button>
                                <Button size="sm" variant="destructive" disabled={reason.trim().length < 3} onClick={() => action({ action: "review_document", documentId: doc.id, decision: "REJECT", reason })}>رد</Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 font-semibold">اقدام مدیریت نماینده</div>
                  <div className="flex flex-wrap gap-2">
                    {detail.status !== "APPROVED" ? <Button size="sm" onClick={() => action({ action: "review_agent", agentId: detail.id, decision: "APPROVE" }, "نماینده تأیید شد")}>تأیید نمایندگی</Button> : null}
                    {detail.status === "PENDING" ? <Button size="sm" variant="outline" onClick={() => action({ action: "review_agent", agentId: detail.id, decision: "START_REVIEW" }, "بررسی آغاز شد")}>شروع بررسی</Button> : null}
                    <Button size="sm" variant="destructive" disabled={reason.trim().length < 3} onClick={() => action({ action: "review_agent", agentId: detail.id, decision: "REJECT", reason })}>رد</Button>
                    {detail.status === "APPROVED" ? <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => action({ action: "review_agent", agentId: detail.id, decision: "SUSPEND", reason })}>تعلیق</Button> : null}
                  </div>
                  <Textarea className="mt-2" rows={2} placeholder="دلیل رد/تعلیق (الزامی)" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* عملیات ← مشاهده جزئیات (عملکرد هنگام فروش) */}
      <AgentDetailsModal
        agent={
          detailsAgent
            ? { id: detailsAgent.id, name: detailsAgent.name, businessName: detailsAgent.businessName, status: detailsAgent.status }
            : null
        }
        onClose={() => setDetailsAgent(null)}
        onReject={(id) => openReview(id, "REJECT")}
        onSuspend={(id) => openReview(id, "SUSPEND")}
      />

      {/* عملیات ← مشاهده / ویرایش اطلاعات */}
      <AgentEditModal agent={editAgent} onClose={() => setEditAgent(null)} onSaved={refreshList} />

      {/* پیش‌نمایش مدرک نماینده — عکس داخل مودال، PDF در تب جدید (نمایشگر داخلی مرورگر) */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl">
          {previewDoc ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {label(previewDoc.docType)} — {previewDoc.fileName}
                </DialogTitle>
                <DialogDescription>
                  پیش‌نمایش مدرک بارگذاری‌شده توسط نماینده؛ پس از بررسی، مدرک را تأیید یا رد کنید.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[65vh] overflow-auto rounded-lg border bg-muted/40 p-2">
                {previewDoc.filePath.toLowerCase().endsWith(".pdf") ? (
                  <div className="flex flex-col items-center gap-3 p-6 text-sm">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p>این مدرک یک فایل PDF است.</p>
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/v1/admin/agent-docs/${previewDoc.id}`, "_blank", "noopener")}>
                      باز کردن PDF در تب جدید
                    </Button>
                  </div>
                ) : (
                  <img
                    src={`/api/v1/admin/agent-docs/${previewDoc.id}`}
                    alt={previewDoc.fileName}
                    className="mx-auto max-h-[60vh] w-auto rounded-md object-contain"
                  />
                )}
              </div>
              {previewDoc.status === "PENDING" ? (
                <DialogFooter className="gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      action({ action: "review_document", documentId: previewDoc.id, decision: "APPROVE" }, "مدرک تأیید شد")
                      setPreviewDoc(null)
                    }}
                  >
                    تأیید مدرک
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={reason.trim().length < 3}
                    onClick={() => {
                      action({ action: "review_document", documentId: previewDoc.id, decision: "REJECT", reason }, "مدرک رد شد")
                      setPreviewDoc(null)
                    }}
                  >
                    رد مدرک {reason.trim().length < 3 ? "(نیاز به دلیل در کادر پایین مودال نماینده)" : ""}
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* عملیات ← رد / تعلیق با ثبت دلیل */}
      <Dialog open={!!reviewAction} onOpenChange={(o) => !o && setReviewAction(null)}>
        <DialogContent className="max-w-md">
          {reviewAction ? (
            <>
              <DialogHeader>
                <DialogTitle>{reviewAction.decision === "REJECT" ? "رد نماینده" : "تعلیق نماینده"}</DialogTitle>
                <DialogDescription>
                  {reviewAction.decision === "REJECT"
                    ? `همکاری «${reviewAction.agent.name}» رد می‌شود؛ لطفاً دلیل را ثبت کنید.`
                    : `همکاری «${reviewAction.agent.name}» به‌طور موقت تعلیق می‌شود؛ لطفاً دلیل را ثبت کنید.`}
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
