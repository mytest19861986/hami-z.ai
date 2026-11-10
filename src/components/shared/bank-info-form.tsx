"use client"

// فرم مشترک اطلاعات بانکی (REF-SYS · SETTLE-002/003)
// محل ورود شماره کارت ۱۶ رقمی و شبا ۲۴ رقمی برای دریافت پورسانت —
// در داشبورد کاربر (کیف پول/پروفایل) و داشبورد همکار فروش (اطلاعات بانکی/تسویه) استفاده می‌شود.

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { toEnDigits, maskCard, maskSheba } from "@/lib/validators"
import { Landmark, Save, CheckCircle2, AlertCircle } from "lucide-react"

export interface BankInfo {
  cardNumber: string | null
  sheba: string | null
  bankAccountName: string | null
}

// نمایش کارت به‌صورت گروه‌های چهارتایی: 6037 9911 2233 4455
export function formatCardDisplay(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ")
}

// نمایش شبا به‌صورت گروه‌های چهارتایی (IR به‌صورت پیشوند ثابت نمایش داده می‌شود)
export function formatShebaDisplay(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ")
}

function cardDigits(raw: string): string {
  return toEnDigits(raw).replace(/\D/g, "").slice(0, 16)
}

function shebaDigits(raw: string): string {
  return toEnDigits(raw).toUpperCase().replace(/^IR/, "").replace(/\D/g, "").slice(0, 24)
}

export function BankInfoForm({
  initial,
  onSaved,
  showSavedBanner = true,
}: {
  initial?: BankInfo | null
  onSaved?: (info: BankInfo) => void
  showSavedBanner?: boolean
}) {
  const [loaded, setLoaded] = useState<boolean>(initial !== undefined)
  const [card, setCard] = useState("")
  const [sheba, setSheba] = useState("")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [savedInfo, setSavedInfo] = useState<BankInfo | null>(null)

  // اعمال مقدار اولیه روی فیلدها (هم‌زمان‌سازی هنگام تغییر prop)
  function applyInitial(p?: BankInfo | null) {
    setCard(p?.cardNumber ? cardDigits(p.cardNumber) : "")
    setSheba(p?.sheba ? shebaDigits(p.sheba) : "")
    setName(p?.bankAccountName ?? "")
    setSavedInfo(p?.cardNumber && p?.sheba ? { cardNumber: p.cardNumber, sheba: p.sheba, bankAccountName: p.bankAccountName } : null)
  }

  // همگام‌سازی با prop initial هنگام تغییر (مثلاً بعد از بارگیری پروفایل در صفحهٔ والد)
  useEffect(() => {
    if (initial !== undefined) applyInitial(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  // اگر مقدار اولیه داده نشد، از پروفایل کاربر بخوان
  useEffect(() => {
    if (initial !== undefined) return
    api
      .get<{ profile: BankInfo | null }>("/api/v1/user/profile")
      .then((d) => applyInitial(d.profile))
      .catch(() => toast({ title: "خطا", description: "بارگیری اطلاعات بانکی ناموفق بود.", variant: "destructive" }))
      .finally(() => setLoaded(true))
  }, [initial])

  const cardOk = card.length === 16
  const shebaOk = sheba.length === 24
  const nameOk = name.trim().length >= 2
  const canSave = cardOk && shebaOk

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      const payload: BankInfo = {
        cardNumber: card,
        sheba: `IR${sheba}`,
        bankAccountName: name.trim(),
      }
      await api.put("/api/v1/user/profile", payload)
      setSavedInfo(payload)
      toast({
        title: "اطلاعات بانکی ذخیره شد",
        description: "شماره کارت و شبا شما برای واریز پورسانت ثبت شد.",
      })
      onSaved?.(payload)
    } catch (e) {
      toast({ title: "خطا در ذخیره", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">اطلاعات بانکی (الزامی برای دریافت پورسانت)</h2>
        </div>
        <p className="rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
          برای اینکه پورسانت‌های شما (معرفی و فروش) تأیید و به کیف پول واریز شود، ثبت شماره کارت ۱۶ رقمی و
          شبا ۲۴ رقمی الزامی است. این اطلاعات فقط برای واریز پورسانت استفاده می‌شود.
        </p>

        {showSavedBanner && savedInfo ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              اطلاعات بانکی ثبت شده: کارت <span dir="ltr" className="font-mono">{maskCard(savedInfo.cardNumber)}</span> · شبا{" "}
              <span dir="ltr" className="font-mono">{maskSheba(savedInfo.sheba)}</span>
              {savedInfo.bankAccountName ? ` · ${savedInfo.bankAccountName}` : ""}
              {nameOk ? "" : " — برای ثبت درخواست تسویه، نام صاحب حساب را نیز تکمیل کنید."}
            </span>
          </div>
        ) : null}

        {/* شماره کارت — دقیقاً ۱۶ رقم */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="bank-card">
            شماره کارت بانکی (۱۶ رقم)
          </label>
          <div className="relative">
            <Input
              id="bank-card"
              dir="ltr"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="6037 9911 2233 4455"
              value={formatCardDisplay(card)}
              onChange={(e) => setCard(cardDigits(e.target.value))}
              className={`text-left font-mono tracking-wider ${card && !cardOk ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
            />
          </div>
          <p className={`text-xs ${card && !cardOk ? "text-amber-600" : "text-muted-foreground"}`}>
            {card && !cardOk
              ? `کارت باید دقیقاً ۱۶ رقم باشد — ${toFaDigitsCount(card)} رقم وارد شده است.`
              : "۱۶ رقم، با یا بدون خط تیره — مثال: 6037 9911 2233 4455"}
          </p>
        </div>

        {/* شبا — IR + ۲۴ رقم */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="bank-sheba">
            شماره شبا (۲۴ رقم)
          </label>
          <div className="relative">
            <span
              dir="ltr"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm font-bold text-muted-foreground"
            >
              IR
            </span>
            <Input
              id="bank-sheba"
              dir="ltr"
              inputMode="numeric"
              placeholder="0170 0000 0000 1234 5678 9012"
              value={formatShebaDisplay(sheba)}
              onChange={(e) => setSheba(shebaDigits(e.target.value))}
              className={`pl-10 text-left font-mono tracking-wider ${sheba && !shebaOk ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
            />
          </div>
          <p className={`text-xs ${sheba && !shebaOk ? "text-amber-600" : "text-muted-foreground"}`}>
            {sheba && !shebaOk
              ? `شبا باید دقیقاً ۲۴ رقم باشد — ${toFaDigitsCount(sheba)} رقم وارد شده است.`
              : "۲۴ رقم بدون نیاز به رقم کنترل — پیشوند IR خودکار ثبت می‌شود."}
          </p>
        </div>

        {/* نام صاحب حساب */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="bank-name">
            نام صاحب حساب <span className="text-muted-foreground">(برای درخواست تسویه الزامی)</span>
          </label>
          <Input
            id="bank-name"
            value={name}
            placeholder="نام و نام خانوادگی صاحب حساب"
            onChange={(e) => setName(e.target.value)}
          />
          {name && !nameOk ? (
            <p className="flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              نام صاحب حساب حداقل ۲ نویسه است و برای ثبت درخواست تسویه لازم است.
            </p>
          ) : null}
        </div>

        <Button onClick={save} disabled={saving || !canSave} className="w-full sm:w-auto">
          <Save className="ml-1 h-4 w-4" />
          {saving ? "در حال ذخیره…" : "ذخیره اطلاعات بانکی"}
        </Button>
      </CardContent>
    </Card>
  )
}

// نمایش تعداد رقم‌ها به عدد فارسی برای پیام‌های راهنما
function toFaDigitsCount(s: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹"
  return String(s.length)
    .split("")
    .map((d) => fa[Number(d)])
    .join("")
}
