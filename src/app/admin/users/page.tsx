"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Pagination } from "@/components/shared/pagination"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { faDate } from "@/lib/jalali"
import { ROLE_NAMES } from "@/constants/permissions"
import { Search } from "lucide-react"

interface UserRow {
  id: string
  mobile: string
  status: string
  firstName: string | null
  lastName: string | null
  nationalCode: string | null
  province: string | null
  city: string | null
  hasBankInfo: boolean
  roles: { name: string; title: string }[]
  doctorStatus: string | null
  agentStatus: string | null
  createdAt: string
}

interface UsersResponse {
  total: number
  page: number
  totalPages: number
  users: UserRow[]
  meta: { roles: { name: string; title: string }[] }
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [q, setQ] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")
  const [detail, setDetail] = useState<UserRow | null>(null)
  const [reason, setReason] = useState("")

  const requestKey = JSON.stringify([q, role, status, page])
  const loading = requestKey !== loadedKey

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (role) params.set("role", role)
    if (status) params.set("status", status)
    params.set("page", String(page))
    api
      .get<UsersResponse>(`/api/v1/admin/users?${params.toString()}`)
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

  async function action(body: Record<string, unknown>) {
    try {
      await api.post("/api/v1/admin/users", body)
      toast({ title: "انجام شد" })
      setDetail(null)
      setReason("")
      api
        .get<UsersResponse>(`/api/v1/admin/users?q=${encodeURIComponent(q)}&role=${role}&status=${status}&page=${page}`)
        .then(setData)
        .catch(() => {})
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    }
  }

  return (
    <div>
      <PageHeader title="کاربران و نقش‌ها" description="جست‌وجو، وضعیت حساب و مدیریت نقش‌ها (ADMIN-001..005)" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="نام، موبایل یا کد ملی…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} className="pr-9" />
        </div>
        <Select value={role || "ALL"} onValueChange={(v) => { setPage(1); setRole(v === "ALL" ? "" : v) }}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه نقش‌ها</SelectItem>
            {Object.entries(ROLE_NAMES).map(([name, title]) => (
              <SelectItem key={name} value={name}>{title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status || "ALL"} onValueChange={(v) => { setPage(1); setStatus(v === "ALL" ? "" : v) }}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="ACTIVE">فعال</SelectItem>
            <SelectItem value="SUSPENDED">تعلیق‌شده</SelectItem>
            <SelectItem value="BLOCKED">مسدود</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : data ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{data.total} کاربر</p>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.users.map((u) => (
                  <div key={u.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button className="text-sm font-semibold hover:text-primary" onClick={() => setDetail(u)}>
                          {[u.firstName, u.lastName].filter(Boolean).join(" ") || "بدون نام"}
                        </button>
                        <span className="text-xs text-muted-foreground" dir="ltr">{u.mobile}</span>
                        <StatusBadge status={u.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {u.roles.map((r) => (
                          <span key={r.name} className="rounded-full bg-muted px-2 py-0.5">{r.title}</span>
                        ))}
                        <span>· {faDate(u.createdAt)}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDetail(u)}>
                      جزئیات و اقدام
                    </Button>
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
              <DialogHeader>
                <DialogTitle>{[detail.firstName, detail.lastName].filter(Boolean).join(" ") || detail.mobile}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-xs">
                  <div>موبایل: <span dir="ltr">{detail.mobile}</span></div>
                  <div>کد ملی: <span dir="ltr">{detail.nationalCode ?? "—"}</span></div>
                  <div>استان/شهر: {detail.province ?? "—"} / {detail.city ?? "—"}</div>
                  <div>اطلاعات بانکی: {detail.hasBankInfo ? "تکمیل" : "—"}</div>
                  <div>عضویت: {faDate(detail.createdAt)}</div>
                  <div>وضعیت: <StatusBadge status={detail.status} /></div>
                  {detail.doctorStatus ? <div>پزشک: <StatusBadge status={detail.doctorStatus} /></div> : null}
                  {detail.agentStatus ? <div>نماینده: <StatusBadge status={detail.agentStatus} /></div> : null}
                </div>

                <div>
                  <Label className="mb-1.5 block">تغییر وضعیت حساب</Label>
                  <div className="flex flex-wrap gap-2">
                    {detail.status !== "ACTIVE" ? (
                      <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => action({ action: "set_status", userId: detail.id, status: "ACTIVE", reason: reason || "فعال‌سازی مجدد" })}>
                        فعال‌سازی
                      </Button>
                    ) : null}
                    {detail.status === "ACTIVE" ? (
                      <>
                        <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => action({ action: "set_status", userId: detail.id, status: "SUSPENDED", reason })}>
                          تعلیق
                        </Button>
                        <Button size="sm" variant="destructive" disabled={reason.trim().length < 3} onClick={() => action({ action: "set_status", userId: detail.id, status: "BLOCKED", reason })}>
                          مسدودسازی
                        </Button>
                      </>
                    ) : null}
                  </div>
                  <Textarea className="mt-2" rows={2} placeholder="دلیل تغییر وضعیت (الزامی برای تعلیق/مسدودی)" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>

                <div>
                  <Label className="mb-1.5 block">نقش‌ها</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ROLE_NAMES)
                      .filter(([name]) => name !== "USER")
                      .map(([name, title]) => {
                        const has = detail.roles.some((r) => r.name === name)
                        return (
                          <Button
                            key={name}
                            size="sm"
                            variant={has ? "default" : "outline"}
                            onClick={() =>
                              has
                                ? action({ action: "revoke_role", userId: detail.id, role: name })
                                : action({ action: "assign_role", userId: detail.id, role: name })
                            }
                          >
                            {has ? "سلب" : "افزودن"}: {title}
                          </Button>
                        )
                      })}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
