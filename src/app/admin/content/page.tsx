"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"

interface PageContentRow {
  id: string
  pageKey: string
  title: string
  body: string
  status: string
}

const PAGE_KEYS: { key: string; title: string }[] = [
  { key: "about", title: "درباره ما" },
  { key: "contact", title: "تماس با ما" },
  { key: "faq", title: "پرسش‌های متداول" },
  { key: "terms", title: "قوانین و شرایط" },
  { key: "privacy", title: "حریم خصوصی" },
]

export default function AdminContentPage() {
  const [pages, setPages] = useState<PageContentRow[] | null>(null)
  const [selected, setSelected] = useState("about")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [status, setStatus] = useState("PUBLISHED")
  const [saving, setSaving] = useState(false)
  const [broadcast, setBroadcast] = useState({ title: "", body: "", audience: "ALL" })
  const [sending, setSending] = useState(false)

  function load() {
    api.get<PageContentRow[]>("/api/v1/admin/content").then(setPages).catch((e) => toast({ title: "خطا", description: errMessage(e), variant: "destructive" }))
  }

  useEffect(load, [])

  useEffect(() => {
    const p = pages?.find((x) => x.pageKey === selected)
    if (p) {
      setTitle(p.title)
      setBody(p.body)
      setStatus(p.status)
    }
  }, [selected, pages])

  async function save() {
    setSaving(true)
    try {
      await api.put("/api/v1/admin/content", { pageKey: selected, title, body, status })
      toast({ title: "محتوا ذخیره شد", description: status === "PUBLISHED" ? "نسخه منتشرشده به‌روزرسانی شد." : "به‌صورت پیش‌نویس ذخیره شد و عمومی نمایش داده نمی‌شود." })
      load()
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function sendBroadcast() {
    setSending(true)
    try {
      const res = await api.post<{ sent: number }>("/api/v1/admin/content", { action: "broadcast", ...broadcast })
      toast({ title: "اعلان ارسال شد", description: `${res.sent} کاربر اعلان را دریافت کردند.` })
      setBroadcast({ title: "", body: "", audience: "ALL" })
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader title="محتوا و اعلان" description="ویرایش صفحات عمومی و ارسال اعلان همگانی (CONTENT-003/004 · NOTICE)" />

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">صفحات عمومی</TabsTrigger>
          <TabsTrigger value="broadcast">اعلان همگانی</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4">
          {!pages ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <div className="grid gap-5 lg:grid-cols-4">
              <Card className="lg:col-span-1 h-fit">
                <CardContent className="p-3">
                  <div className="space-y-1">
                    {PAGE_KEYS.map((pk) => {
                      const row = pages.find((p) => p.pageKey === pk.key)
                      return (
                        <button
                          key={pk.key}
                          onClick={() => setSelected(pk.key)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm ${selected === pk.key ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}
                        >
                          <span>{pk.title}</span>
                          {row ? <StatusBadge status={row.status} /> : <span className="text-xs text-muted-foreground">جدید</span>}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-1.5">
                    <Label>عنوان صفحه</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>متن صفحه</Label>
                    <Textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="leading-7" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLISHED">منتشرشده</SelectItem>
                        <SelectItem value="DRAFT">پیش‌نویس (عمومی نمایش داده نمی‌شود)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={save} disabled={saving || !title || body.length < 10}>
                      {saving ? "در حال ذخیره…" : "ذخیره"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4">
          <Card className="max-w-xl">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1.5">
                <Label>مخاطبان</Label>
                <Select value={broadcast.audience} onValueChange={(v) => setBroadcast({ ...broadcast, audience: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">همه کاربران فعال</SelectItem>
                    <SelectItem value="ACTIVE_MEMBERS">دارندگان عضویت فعال</SelectItem>
                    <SelectItem value="AGENTS">نمایندگان تأییدشده</SelectItem>
                    <SelectItem value="DOCTORS">پزشکان تأییدشده</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>عنوان اعلان</Label>
                <Input value={broadcast.title} onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>متن اعلان</Label>
                <Textarea rows={4} value={broadcast.body} onChange={(e) => setBroadcast({ ...broadcast, body: e.target.value })} />
              </div>
              <Button onClick={sendBroadcast} disabled={sending || !broadcast.title || !broadcast.body}>
                {sending ? "در حال ارسال…" : "ارسال اعلان"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
