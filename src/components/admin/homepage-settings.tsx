"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { faDate } from "@/lib/jalali"
import { ImageIcon, Plus, Trash2, EyeOff, Eye, ArrowUp, ArrowDown, Upload, Info, Star } from "lucide-react"

interface BannerRow {
  id: string
  imageUrl: string
  title: string | null
  linkUrl: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
}

/**
 * تنظیمات صفحه اصلی — بنرهای اسلایدی جایگاه «عکس کارت» در هیرو.
 * آپلود عکس (JPG/PNG/WebP تا ۳MB)، عنوان/لینک اختیاری، فعال/غیرفعال، ترتیب و حذف.
 */
export function HomepageSettings() {
  const [banners, setBanners] = useState<BannerRow[] | null>(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [title, setTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<BannerRow | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api
      .get<{ banners: BannerRow[] }>("/api/v1/admin/homepage-banners")
      .then((d) => setBanners(d.banners))
      .catch((e) => {
        toast({ title: "خطا در دریافت بنرها", description: errMessage(e), variant: "destructive" })
        setBanners([])
      })
  }, [])

  function pickFile(f: File | null) {
    if (!f) return
    // اعتبارسنجی سمت کلاینت (سرور هم با امضای فایل چک می‌کند)
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      toast({ title: "فرمت نامعتبر", description: "فقط JPG، PNG یا WebP مجاز است.", variant: "destructive" })
      return
    }
    if (f.size > 3_000_000) {
      toast({ title: "حجم زیاد", description: "حجم بنر حداکثر ۳ مگابایت می‌تواند باشد.", variant: "destructive" })
      return
    }
    setFile(f)
    const reader = new FileReader()
    reader.onload = () => setPreview(String(reader.result))
    reader.readAsDataURL(f)
  }

  async function upload() {
    if (!file) return
    setSaving(true)
    try {
      const base64 = preview.split(",")[1]
      await api.post("/api/v1/admin/homepage-banners", { mode: "upload", fileBase64: base64, fileName: file.name, title: title.trim(), linkUrl: linkUrl.trim() })
      toast({ title: "بنر اضافه شد", description: "بنر جدید فعال است و در اسلایدر صفحه اصلی نمایش داده می‌شود." })
      setOpen(false)
      setFile(null)
      setPreview("")
      setTitle("")
      setLinkUrl("")
      api.get<{ banners: BannerRow[] }>("/api/v1/admin/homepage-banners").then((d) => setBanners(d.banners)).catch(() => {})
    } catch (e) {
      toast({ title: "خطا در بارگذاری بنر", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function toggle(b: BannerRow) {
    setBusy(b.id)
    try {
      await api.put("/api/v1/admin/homepage-banners", { bannerId: b.id, isActive: !b.isActive })
      setBanners((prev) => (prev ?? []).map((x) => (x.id === b.id ? { ...x, isActive: !x.isActive } : x)))
      toast({ title: b.isActive ? "بنر غیرفعال شد" : "بنر فعال شد", description: b.isActive ? "این بنر دیگر در صفحه اصلی نمایش داده نمی‌شود." : "این بنر در اسلایدر صفحه اصلی نمایش داده می‌شود." })
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setBusy("")
    }
  }

  async function move(b: BannerRow, dir: -1 | 1) {
    const list = banners ?? []
    const idx = list.findIndex((x) => x.id === b.id)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return
    const next = [...list]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    // به‌روزرسانی خوش‌بینانه + ارسال ترتیب جدید هر دو بنر جابه‌جاشده
    setBanners(next.map((x, i) => ({ ...x, sortOrder: i + 1 })))
    try {
      await api.put("/api/v1/admin/homepage-banners", { bannerId: next[idx].id, sortOrder: idx + 1 })
      await api.put("/api/v1/admin/homepage-banners", { bannerId: next[swapIdx].id, sortOrder: swapIdx + 1 })
    } catch (e) {
      toast({ title: "خطا در تغییر ترتیب", description: errMessage(e), variant: "destructive" })
      api.get<{ banners: BannerRow[] }>("/api/v1/admin/homepage-banners").then((d) => setBanners(d.banners)).catch(() => {})
    }
  }

  async function remove(b: BannerRow) {
    setBusy(b.id)
    try {
      await api.delete("/api/v1/admin/homepage-banners", { bannerId: b.id })
      toast({ title: "بنر حذف شد", description: "عکس بنر نیز از فضای ذخیره‌سازی پاک شد." })
      setConfirmDelete(null)
      setBanners((prev) => (prev ?? []).filter((x) => x.id !== b.id))
    } catch (e) {
      toast({ title: "خطا در حذف", description: errMessage(e), variant: "destructive" })
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        تنظیمات صفحه اصلی
        <span className="text-xs font-normal text-muted-foreground">(بنرهای اسلایدی جایگاه کارت در هیرو)</span>
      </h2>

      {/* راهنمای سایز بنر — کوچک و کاربردی */}
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs leading-6 text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <span className="font-bold">راهنمای سایز عکس بنر:</span> عرض پیشنهادی <span className="font-bold">۹۶۰ پیکسل</span> و ارتفاع <span className="font-bold">۷۲۰ پیکسل</span> (نسبت ۴:۳ — هم‌اندازهٔ جایگاه کارت در صفحه اصلی). فرمت JPG، PNG یا WebP با حجم حداکثر ۳ مگابایت. بنرهای شما به‌صورت اسلایدی (چرخش خودکار هر ۵ ثانیه) <span className="font-bold">بعد از کارت برند پیش‌فرض</span> نمایش داده می‌شوند؛ عکس‌های افقی بدون حاشیه بهترین نتیجه را دارند.
        </div>
      </div>

      {/* اسلاید اول — کارت برند پیش‌فرض (ثابت و همیشگی) */}
      <div className="mb-4 rounded-xl border border-gold/40 bg-gold/5 p-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="w-44 shrink-0 overflow-hidden rounded-lg border border-gold/30 bg-sidebar p-3 text-sidebar-foreground shadow-md">
            <div className="bg-girih-light relative rounded-md p-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-gold" />
                  <span className="font-display text-[11px] font-bold">کارت حامی‌کارت</span>
                </span>
                <span className="rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold text-sidebar">عضویت</span>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-sidebar-border pt-2">
                <span className="text-[9px] text-sidebar-foreground/70">دارندهٔ کارت</span>
                <span className="font-display text-base font-extrabold text-gold">۳۰٪</span>
              </div>
            </div>
          </div>
          <div className="flex-1 text-xs leading-6 text-muted-foreground">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Star className="h-4 w-4 text-gold" />
              اسلاید اول: کارت برند پیش‌فرض
            </p>
            <p className="mt-1">
              این اسلاید همیشه اولین تصویر اسلایدر صفحه اصلی است و نمایش آن همیشگی است؛ بنرهایی که شما اضافه می‌کنید
              پس از آن به‌صورت چرخشی نمایش داده می‌شوند. این اسلاید قابل حذف یا غیرفعال‌سازی نیست و نیازی به تنظیم ندارد.
            </p>
          </div>
        </div>
      </div>

      {/* افزودن بنر */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{banners ? `${banners.length} بنر ثبت شده` : "…"}</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="ml-1 h-4 w-4" />
          افزودن بنر جدید
        </Button>
      </div>

      {!banners ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : banners.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          هنوز بنری ثبت نشده است — اسلایدر صفحه اصلی فقط کارت برند پیش‌فرض را نشان می‌دهد. اولین بنر خود را اضافه کنید.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((b, i) => (
            <Card key={b.id} className={`overflow-hidden ${!b.isActive ? "opacity-60" : ""}`}>
              <div className="relative aspect-[4/3] bg-muted">
                { }
                <img src={b.imageUrl} alt={b.title ?? "بنر"} className="h-full w-full object-cover" />
                <span className="absolute right-2 top-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                  #{i + 2}
                </span>
                {!b.isActive ? (
                  <span className="absolute left-2 top-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">غیرفعال</span>
                ) : null}
              </div>
              <CardContent className="space-y-2 p-3">
                <div className="truncate text-xs">
                  <span className="text-muted-foreground">عنوان: </span>
                  {b.title || <span className="text-muted-foreground">—</span>}
                </div>
                <div className="truncate text-xs">
                  <span className="text-muted-foreground">لینک: </span>
                  {b.linkUrl ? <span dir="ltr" className="font-mono">{b.linkUrl}</span> : <span className="text-muted-foreground">—</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">افزوده: {faDate(b.createdAt)}</div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Button variant="outline" size="sm" className="h-7 px-2" disabled={busy === b.id || i === 0} onClick={() => move(b, -1)} title="جابه‌جایی به قبل">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" disabled={busy === b.id || i === banners.length - 1} onClick={() => move(b, 1)} title="جابه‌جایی به بعد">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex items-center gap-1.5 pr-1">
                    <Switch checked={b.isActive} onCheckedChange={() => toggle(b)} disabled={busy === b.id} aria-label="فعال/غیرفعال" />
                    <span className="text-[11px] text-muted-foreground">{b.isActive ? <Eye className="inline h-3.5 w-3.5" /> : <EyeOff className="inline h-3.5 w-3.5" />} {b.isActive ? "فعال" : "غیرفعال"}</span>
                  </div>
                  <Button variant="destructive" size="sm" className="mr-auto h-7 px-2" disabled={busy === b.id} onClick={() => setConfirmDelete(b)} title="حذف کامل بنر">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* مودال افزودن بنر */}
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              افزودن بنر صفحه اصلی
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* انتخاب فایل با پیش‌نمایش */}
            <div className="space-y-1.5">
              <Label>عکس بنر * (۹۶۰×۷۲۰ پیکسل پیشنهادی — JPG/PNG/WebP تا ۳MB)</Label>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="ml-1 h-4 w-4" />
                {file ? "تغییر فایل" : "انتخاب عکس"}
              </Button>
              {preview ? (
                <div className="overflow-hidden rounded-lg border">
                  { }
                  <img src={preview} alt="پیش‌نمایش بنر" className="aspect-[4/3] w-full object-cover" />
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>عنوان بنر (اختیاری — نمایش در اسلایدر)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="مثلاً: طرح ویژهٔ خانواده" />
            </div>
            <div className="space-y-1.5">
              <Label>لینک هنگام کلیک (اختیاری)</Label>
              <Input dir="ltr" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} maxLength={300} placeholder="https://… یا /plans" className="text-left" />
            </div>
            <Button className="w-full" size="lg" disabled={saving || !file} onClick={upload}>
              {saving ? "در حال بارگذاری…" : "ثبت بنر"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* تأیید حذف */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>حذف بنر</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-6 text-muted-foreground">
            این بنر برای همیشه حذف می‌شود (عکس آن نیز از فضای ذخیره‌سازی پاک می‌شود). اگر فقط می‌خواهید موقتاً از صفحه اصلی حذف شود، از کلید «فعال/غیرفعال» استفاده کنید.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>انصراف</Button>
            <Button variant="destructive" className="flex-1" disabled={busy === confirmDelete?.id} onClick={() => confirmDelete && remove(confirmDelete)}>
              حذف کامل
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
