"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { faDateTime } from "@/lib/jalali"
import { label } from "@/constants/labels"
import { Upload, FileCheck2 } from "lucide-react"

interface DocItem {
  id: string
  docType: string
  fileName: string
  status: string
  rejectReason: string | null
  createdAt: string
}

export default function AgentDocumentsPage() {
  const [docs, setDocs] = useState<DocItem[] | null>(null)
  const [docType, setDocType] = useState("NATIONAL_CARD")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  function load() {
    api
      .get<{ documents: DocItem[] } | null>("/api/v1/agent/status")
      .then((d) => setDocs(d?.documents ?? []))
      .catch(() => setDocs([]))
  }

  useEffect(load, [])

  async function upload() {
    if (!file) return
    setLoading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await api.post("/api/v1/agent/documents", { docType, fileName: file.name, fileBase64: base64 })
      toast({ title: "مدرک بارگذاری شد", description: "در انتظار بررسی مدیر." })
      setFile(null)
      load()
    } catch (e) {
      toast({ title: "خطا در بارگذاری", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="مدارک همکاری"
        description="کارکارت ملی و مجوز فعالیت بارگذاری کنید (JPG/PNG/PDF، حداکثر ~۲MB) — حداقل یک مدرک تأییدشده برای تأیید نمایندگی لازم است (AGENT-003/004 · ADMIN-009)."
      />

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-end">
          <div className="w-full space-y-1.5 sm:w-56">
            <label className="text-sm font-medium">نوع مدرک</label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NATIONAL_CARD">کارت ملی</SelectItem>
                <SelectItem value="BUSINESS_LICENSE">مجوز فعالیت</SelectItem>
                <SelectItem value="OTHER">سایر مدارک</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">فایل مدرسک</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm file:ml-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-primary"
            />
          </div>
          <Button onClick={upload} disabled={loading || !file}>
            <Upload className="ml-1 h-4 w-4" />
            {loading ? "در حال بارگذاری…" : "بارگذاری"}
          </Button>
        </CardContent>
      </Card>

      {!docs ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : docs.length === 0 ? (
        <EmptyState title="مدرکی بارگذاری نشده است" description="برای تسریع بررسی، مدارک خود را بارگذاری کنید." action={<FileCheck2 className="h-8 w-8 text-muted-foreground" />} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label(d.docType)}</span>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{d.fileName} · {faDateTime(d.createdAt)}</div>
                    {d.rejectReason ? <div className="mt-1 text-xs text-rose-600">دلیل رد: {d.rejectReason}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
