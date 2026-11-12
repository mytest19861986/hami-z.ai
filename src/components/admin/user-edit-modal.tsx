"use client"

// مودال «مشاهده / ویرایش اطلاعات» — دکمهٔ عملیات در صفحهٔ کاربران ادمین (ADMIN-002)
// فیلدها مطابق پروفایل کاربر: نام، نام خانوادگی، کد ملی، استان/شهر،
// آدرس، کد پستی و اطلاعات بانکی (کارت، شبا، صاحب حساب)
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ProvinceCitySelect } from "@/components/shared/province-city-select"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { isValidNationalCode, isValidCardNumber, isValidSheba, normalizeSheba, toEnDigits } from "@/lib/validators"
import { Save } from "lucide-react"

export interface EditableUserInfo {
  id: string
  mobile: string
  firstName: string | null
  lastName: string | null
  nationalCode: string | null
  province: string | null
  city: string | null
  address: string | null
  postalCode: string | null
  cardNumber: string | null
  sheba: string | null
  bankAccountName: string | null
}

export function UserEditModal({
  user,
  onClose,
  onSaved,
}: {
  user: EditableUserInfo | null
  onClose: () => void
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [nationalCode, setNationalCode] = useState("")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [address, setAddress] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [cardNumber, setCardNumber] = useState("")
  const [sheba, setSheba] = useState("")
  const [bankAccountName, setBankAccountName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "")
      setLastName(user.lastName ?? "")
      setNationalCode(user.nationalCode ?? "")
      setProvince(user.province ?? "")
      setCity(user.city ?? "")
      setAddress(user.address ?? "")
      setPostalCode(user.postalCode ?? "")
      setCardNumber(user.cardNumber ?? "")
      setSheba(user.sheba ?? "")
      setBankAccountName(user.bankAccountName ?? "")
    }
  }, [user?.id])

  async function save() {
    if (!user) return
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "نام و نام خانوادگی الزامی است", description: "نام و نام خانوادگی کاربر را وارد کنید.", variant: "destructive" })
      return
    }
    const nc = toEnDigits(nationalCode).trim()
    if (nc && !isValidNationalCode(nc)) {
      toast({ title: "کد ملی نامعتبر است", description: "کد ملی باید دقیقاً ۱۰ رقم باشد.", variant: "destructive" })
      return
    }
    const pc = toEnDigits(postalCode).trim()
    if (pc && !/^\d{10}$/.test(pc)) {
      toast({ title: "کد پستی نامعتبر است", description: "کد پستی باید دقیقاً ۱۰ رقم باشد.", variant: "destructive" })
      return
    }
    const card = toEnDigits(cardNumber).replace(/[\s-]/g, "")
    if (card && !isValidCardNumber(card)) {
      toast({ title: "شماره کارت نامعتبر است", description: "شماره کارت باید دقیقاً ۱۶ رقم باشد.", variant: "destructive" })
      return
    }
    const sh = sheba.trim() ? normalizeSheba(sheba) : ""
    if (sh && !isValidSheba(sh)) {
      toast({ title: "شماره شبا نامعتبر است", description: "شماره شبا باید ۲۴ رقم باشد (با یا بدون IR).", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      await api.post("/api/v1/admin/users", {
        action: "update_profile",
        userId: user.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nationalCode: nc,
        province,
        city,
        address: address.trim(),
        postalCode: pc,
        cardNumber: card,
        sheba: sh,
        bankAccountName: bankAccountName.trim(),
      })
      toast({ title: "ذخیره شد", description: "اطلاعات کاربر با موفقیت به روز رسانی شد." })
      onSaved()
      onClose()
    } catch (e) {
      toast({ title: "خطا در ذخیره اطلاعات", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {user ? (
          <>
            <DialogHeader>
              <DialogTitle>مشاهده / ویرایش اطلاعات</DialogTitle>
              <DialogDescription>می‌توانید در این قسمت اطلاعات کاربر را مشاهده و ویرایش کنید.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="user-first-name">نام <span className="text-destructive">*</span></Label>
                <Input id="user-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-last-name">نام خانوادگی <span className="text-destructive">*</span></Label>
                <Input id="user-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-national-code">کد ملی</Label>
                <Input id="user-national-code" dir="ltr" inputMode="numeric" value={nationalCode} onChange={(e) => setNationalCode(e.target.value)} className="text-left" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-mobile">موبایل (شناسه ورود)</Label>
                <Input id="user-mobile" dir="ltr" value={user.mobile} disabled className="text-left" />
              </div>
              <div className="sm:col-span-2">
                <ProvinceCitySelect province={province} city={city} onChange={({ province: p, city: c }) => { setProvince(p); setCity(c) }} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="user-address">آدرس</Label>
                <Textarea id="user-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-postal-code">کد پستی</Label>
                <Input id="user-postal-code" dir="ltr" inputMode="numeric" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="text-left" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-bank-account-name">نام صاحب حساب</Label>
                <Input id="user-bank-account-name" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-card-number">شماره کارت بانکی</Label>
                <Input id="user-card-number" dir="ltr" inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} className="text-left" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-sheba">شماره شبا</Label>
                <Input id="user-sheba" dir="ltr" value={sheba} onChange={(e) => setSheba(e.target.value)} className="text-left" placeholder="IR…" />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>انصراف</Button>
              <Button onClick={save} disabled={saving}>
                <Save className="size-4" />
                {saving ? "در حال ذخیره…" : "ذخیره"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
