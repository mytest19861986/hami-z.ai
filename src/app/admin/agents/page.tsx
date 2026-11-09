"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { faDate } from "@/lib/jalali"
import { toFaDigits } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { Search } from "lucide-react"

interface AgentDoc {
  id: string
  docType: string
  fileName: string
  status: string
  rejectReason: string | null
}

interface AgentRow {
  id: string
  name: string
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

export default function AdminAgentsPage() {
  const [data, setData] = useState<AgentsResponse | null>(null)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [detail, setDetail] = useState<AgentRow | null>(null)
  const [reason, setReason] = useState("")

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

  async function action(body: Record<string, unknown>, successMsg = "انجام شد") {
    try {
      await api.post("/api/v1/admin/agents", body)
      toast({ title: successMsg })
      api.get<AgentsResponse>(fetchUrl())
        .then((d) => {
          setData(d)
          if (detail) {
            const updated = d.agents.find((a) => a.id === detail.id)
            if (updated) setDetail(updated)
          }
        })
        .catch(() => {})
      setReason("")
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
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
                    <Button variant="outline" size="sm" onClick={() => setDetail(a)}>بررسی</Button>
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
                          {doc.status === "PENDING" ? (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => action({ action: "review_document", documentId: doc.id, decision: "APPROVE" }, "مدرک تأیید شد")}>تأیید</Button>
                              <Button size="sm" variant="destructive" disabled={reason.trim().length < 3} onClick={() => action({ action: "review_document", documentId: doc.id, decision: "REJECT", reason })}>رد</Button>
                            </div>
                          ) : null}
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
    </div>
  )
}
