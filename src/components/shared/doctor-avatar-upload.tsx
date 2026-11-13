"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { Camera, Trash2, UserRound } from "lucide-react"

// آپلود عکس پروفایل پزشک (DOCTOR-DASH-007) — انتخاب فایل، پیش‌نمایش و بارگذاری base64
// الگو همان آپلود مدارک نماینده؛ فیلتر سمت کلاینت JPG/PNG/WebP تا ۲MB.
export function DoctorAvatarUpload({
  avatarUrl,
  onUpdated,
}: {
  avatarUrl: string | null
  onUpdated: (avatarUrl: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function upload(file: File) {
    if (!/image\/(jpeg|png|webp)/.test(file.type)) {
      toast({ title: "فرمت نامعتبر", description: "فقط عکس JPG، PNG یا WebP مجاز است.", variant: "destructive" })
      return
    }
    if (file.size > 2_000_000) {
      toast({ title: "حجم زیاد", description: "حجم عکس حداکثر ۲ مگابایت می‌تواند باشد.", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await api.post<{ avatarUrl: string }>("/api/v1/doctor/avatar", {
        fileName: file.name,
        fileBase64: base64,
      })
      setPreview(null)
      onUpdated(res.avatarUrl)
      toast({ title: "عکس پروفایل به‌روزرسانی شد", description: "عکس شما روی پروفایل نمایش داده می‌شود." })
    } catch (e) {
      toast({ title: "خطا در بارگذاری", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function remove() {
    setLoading(true)
    try {
      await api.delete("/api/v1/doctor/avatar")
      setPreview(null)
      onUpdated(null)
      toast({ title: "عکس پروفایل حذف شد" })
    } catch (e) {
      toast({ title: "خطا در حذف", description: errMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const shown = preview ?? avatarUrl

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border bg-muted">
        {shown ? (
          <img src={shown} alt="عکس پروفایل" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <UserRound className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => inputRef.current?.click()}>
            <Camera className="ml-1 h-4 w-4" />
            {loading ? "در حال بارگذاری…" : avatarUrl ? "تغییر عکس پروفایل" : "بارگذاری عکس پروفایل"}
          </Button>
          {avatarUrl ? (
            <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={remove}>
              <Trash2 className="ml-1 h-4 w-4" />
              حذف عکس
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          فرمت JPG، PNG یا WebP · حداکثر ۲ مگابایت · نمایش مربعی (پیشنهاد ۴۰۰×۴۰۰ پیکسل)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            // پیش‌نمایش محلی پیش از ارسال
            setPreview(URL.createObjectURL(f))
            upload(f)
          }}
        />
      </div>
    </div>
  )
}
