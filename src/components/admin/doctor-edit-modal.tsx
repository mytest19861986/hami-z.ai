"use client"

// مودال «مشاهده / ویرایش اطلاعات» — دکمهٔ عملیات در صفحهٔ پزشکان ادمین
// فیلدها مطابق طرح مرجع: نام، نام خانوادگی، آدرس، تحصیلات، نام مطب، آدرس مطب،
// تلفن مطب، پزشک معرف، استان و شهر (با جستجو)
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { api, errMessage } from "@/lib/client"
import { PROVINCES, PROVINCE_NAMES, citiesOf } from "@/constants/geo"
import { toast } from "@/hooks/use-toast"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EditableDoctorInfo {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  address?: string | null
  education?: string | null
  clinicName?: string | null
  clinicAddress?: string | null
  clinicPhone?: string | null
  referrerDoctor?: string | null
  province?: string | null
  city?: string | null
}

export function DoctorEditModal({
  doctor,
  onClose,
  onSaved,
}: {
  doctor: EditableDoctorInfo | null
  onClose: () => void
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [address, setAddress] = useState("")
  const [education, setEducation] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [clinicAddress, setClinicAddress] = useState("")
  const [clinicPhone, setClinicPhone] = useState("")
  const [referrerDoctor, setReferrerDoctor] = useState("")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [cityOpen, setCityOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (doctor) {
      setFirstName(doctor.firstName ?? "")
      setLastName(doctor.lastName ?? "")
      setAddress(doctor.address ?? "")
      setEducation(doctor.education ?? "")
      setClinicName(doctor.clinicName ?? "")
      setClinicAddress(doctor.clinicAddress ?? "")
      setClinicPhone(doctor.clinicPhone ?? "")
      setReferrerDoctor(doctor.referrerDoctor ?? "")
      setProvince(doctor.province ?? "")
      setCity(doctor.city ?? "")
      setCityOpen(false)
    }
  }, [doctor?.id])

  // فهرست شهرها + شهر ذخیره‌شدهٔ قبلی (اگر در فهرست نیست تا داده کهنه پنهان نشود)
  const cityList = citiesOf(province)
  const options = city && !cityList.includes(city) ? [...cityList, city] : cityList

  async function save() {
    if (!doctor) return
    if (province && city && !PROVINCES[province]?.includes(city)) {
      toast({
        title: "شهر معتبر نیست",
        description: "شهر انتخاب‌شده در فهرست شهرهای این استان نیست؛ از فهرست انتخاب کنید.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      await api.post("/api/v1/admin/doctors", {
        action: "update_profile",
        doctorId: doctor.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        address: address.trim(),
        education: education.trim(),
        clinicName: clinicName.trim(),
        clinicAddress: clinicAddress.trim(),
        clinicPhone: clinicPhone.trim(),
        referrerDoctor: referrerDoctor.trim(),
        province,
        city,
      })
      toast({ title: "ذخیره شد", description: "اطلاعات پزشک با موفقیت بهروزرسانی شد." })
      onSaved()
      onClose()
    } catch (e) {
      toast({ title: "خطا در ذخیره اطلاعات", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!doctor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {doctor ? (
          <>
            <DialogHeader>
              <DialogTitle>مشاهده / ویرایش اطلاعات</DialogTitle>
              <DialogDescription>می‌توانید در این قسمت اطلاعات پزشک را مشاهده و ویرایش کنید.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="doc-firstName">نام</Label>
                <Input id="doc-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-lastName">نام خانوادگی</Label>
                <Input id="doc-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="doc-address">آدرس</Label>
                <Input id="doc-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-education">تحصیلات</Label>
                <Input id="doc-education" value={education} onChange={(e) => setEducation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-clinicName">نام مطب</Label>
                <Input id="doc-clinicName" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="doc-clinicAddress">آدرس مطب</Label>
                <Input id="doc-clinicAddress" value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-clinicPhone">تلفن مطب</Label>
                <Input id="doc-clinicPhone" dir="ltr" inputMode="tel" className="text-left" value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-referrerDoctor">پزشک معرف</Label>
                <Input id="doc-referrerDoctor" value={referrerDoctor} onChange={(e) => setReferrerDoctor(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>استان</Label>
                <Select
                  value={province || undefined}
                  onValueChange={(v) => {
                    setProvince(v)
                    setCity("")
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب استان" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PROVINCE_NAMES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>شهر</Label>
                <Popover open={cityOpen} onOpenChange={setCityOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={cityOpen}
                      disabled={!province}
                      className="w-full justify-between font-normal"
                    >
                      {city || "جستجوی شهر"}
                      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="جستجوی شهر…" />
                      <CommandList>
                        <CommandEmpty>شهری یافت نشد.</CommandEmpty>
                        <CommandGroup>
                          {options.map((c) => (
                            <CommandItem
                              key={c}
                              value={c}
                              onSelect={(v) => {
                                setCity(v === city ? "" : v)
                                setCityOpen(false)
                              }}
                            >
                              <Check className={cn("size-4", city === c ? "opacity-100" : "opacity-0")} />
                              {c}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                انصراف
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? "در حال ذخیره…" : "ذخیره اطلاعات"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
