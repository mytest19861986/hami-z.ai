"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { api, errMessage } from "@/lib/client"
import { toast } from "@/hooks/use-toast"
import { formatToman } from "@/lib/format"
import { toFaDigits } from "@/lib/jalali"
import { ShieldAlert, Info } from "lucide-react"

interface SettingRow {
  key: string
  value: string
  title: string
  description: string | null
  superOnly: boolean
  group: string
}

export default function AdminSettingsPage() {
  const [data, setData] = useState<{ settings: SettingRow[]; isSuperAdmin: boolean } | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState("")

  useEffect(() => {
    api
      .get<{ settings: SettingRow[]; isSuperAdmin: boolean }>("/api/v1/admin/settings")
      .then((d) => {
        setData(d)
        setValues(Object.fromEntries(d.settings.map((s) => [s.key, s.value])))
      })
      .catch((e) => toast({ title: "خطا", description: errMessage(e), variant: "destructive" }))
  }, [])

  async function save(key: string) {
    setSaving(key)
    try {
      await api.put("/api/v1/admin/settings", { key, value: values[key] })
      toast({ title: "تنظیم ذخیره شد" })
    } catch (e) {
      toast({ title: "خطا", description: errMessage(e), variant: "destructive" })
    } finally {
      setSaving("")
    }
  }

  if (!data) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-72 rounded-xl" /></div>
  }

  const groups = ["مالی و تجاری", "هویت و نقش‌ها", "عملیات و زیرساخت"]

  return (
    <div>
      <PageHeader title="تنظیمات محصول و تصمیم‌های تجاری" description="مقادیر مصوب OPEN-01 تا OPEN-18 و تنظیمات عمومی — تغییر مقادیر حساس فقط برای مدیر ارشد مجاز است (ADMIN-020/023)" />

      {!data.isSuperAdmin ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span>شما با نقش مدیر عادی وارد شده‌اید؛ مقادیر حساس فقط قابل مشاهده است و ذخیره تغییرات نیازمند اختیار مدیر ارشد است.</span>
        </div>
      ) : null}

      {groups.map((g) => {
        const rows = data.settings.filter((s) => s.group === g)
        if (rows.length === 0) return null
        return (
          <section key={g} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {g}
              <span className="text-xs font-normal text-muted-foreground">({toFaDigits(rows.length)} تنظیم)</span>
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {rows.map((s) => (
                <SettingCard key={s.key} s={s} locked={s.superOnly && !data.isSuperAdmin} values={values} setValues={setValues} saving={saving} onSave={save} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function SettingCard({
  s,
  locked,
  values,
  setValues,
  saving,
  onSave,
}: {
  s: SettingRow
  locked: boolean
  values: Record<string, string>
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  saving: string
  onSave: (key: string) => void
}) {
  const isMinAmount = s.key === "MIN_SETTLEMENT_AMOUNT"
  const numericKeys = ["MIN_SETTLEMENT_AMOUNT", "MEDICAL_DATA_RETENTION_DAYS", "BACKUP_RETENTION_DAYS", "CONCURRENT_USER_TARGET"]
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-6">{s.title}</h3>
          {s.superOnly ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              <ShieldAlert className="h-3 w-3" />
              حساس — مدیر ارشد
            </span>
          ) : null}
        </div>
        {s.description ? (
          <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {s.description}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Input
            dir="ltr"
            inputMode={numericKeys.includes(s.key) ? "numeric" : undefined}
            value={values[s.key] ?? ""}
            onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
            disabled={locked}
            className="text-left"
          />
          <Button size="sm" disabled={locked || saving === s.key} onClick={() => onSave(s.key)}>
            {saving === s.key ? "…" : "ذخیره"}
          </Button>
        </div>
        {isMinAmount ? (
          <p className="text-xs text-muted-foreground">پیش‌نمایش: {formatToman(parseInt(values[s.key] || "0", 10) || 0)}</p>
        ) : null}
        {locked ? <p className="text-xs text-amber-700">فقط مدیر ارشد می‌تواند این مقدار را تغییر دهد.</p> : null}
      </CardContent>
    </Card>
  )
}
