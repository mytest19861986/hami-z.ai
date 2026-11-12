"use client"

// مودال «مشاهده / ویرایش اطلاعات» — دکمهٔ عملیات در صفحهٔ نمایندگان فروش ادمین
// فیلدها مطابق فرم ثبت درخواست همکاری: نام، نام خانوادگی، نام کسب‌وکار،
// تلفن، استان و شهر و توضیحات
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ProvinceCitySelect } from "@/components/shared/province-city-select"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { Save } from "lucide-react"

export interface EditableAgentInfo {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  mobile: string
  businessName?: string | null
  description?: string | null
  province?: string | null
  city?: string | null
  phone?: string | null
}

export function AgentEditModal({
  agent,
  onClose,
  onSaved,
}: {
  agent: EditableAgentInfo | null
  onClose: () => void
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [phone, setPhone] = useState("")
  const [description, setDescription] = useState("")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (agent) {
      setFirstName(agent.firstName ?? "")
      setLastName(agent.lastName ?? "")
      setBusinessName(agent.businessName ?? "")
      setPhone(agent.phone ?? "")
      setDescription(agent.description ?? "")
      setProvince(agent.province ?? "")
      setCity(agent.city ?? "")
    }
  }, [agent?.id])

  async function save() {
    if (!agent) return
    if (!businessName.trim()) {
      toast({ title: "نام کسب‌وکار الزامی است", description: "نام کسب‌وکار نماینده را وارد کنید.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await api.post("/api/v1/admin/agents", {
        action: "update_profile",
        agentId: agent.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        businessName: businessName.trim(),
        description: description.trim(),
        phone: phone.trim(),
        province,
        city,
      })
      toast({ title: "ذخیره شد", description: "اطلاعات نماینده با موفقیت به روز رسانی شد." })
      onSaved()
      onClose()
    } catch (e) {
      toast({ title: "خطا در ذخیره اطلاعات", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {agent ? (
          <>
            <DialogHeader>
              <DialogTitle>مشاهده / ویرایش اطلاعات</DialogTitle>
              <DialogDescription>می‌توانید در این قسمت اطلاعات نماینده فروش را مشاهده و ویرایش کنید.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="agent-first-name">نام</Label>
                <Input id="agent-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-last-name">نام خانوادگی</Label>
                <Input id="agent-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-business">نام کسب‌وکار <span className="text-destructive">*</span></Label>
                <Input id="agent-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-phone">تلفن</Label>
                <Input id="agent-phone" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="text-left" />
              </div>
              <div className="sm:col-span-1">
                <ProvinceCitySelect province={province} city={city} onChange={({ province: p, city: c }) => { setProvince(p); setCity(c) }} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-mobile">موبایل (شناسه ورود)</Label>
                <Input id="agent-mobile" dir="ltr" value={agent.mobile} disabled className="text-left" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="agent-description">توضیحات</Label>
                <Textarea id="agent-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
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
