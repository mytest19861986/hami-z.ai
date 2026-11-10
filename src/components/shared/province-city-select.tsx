"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROVINCES, PROVINCE_NAMES } from "@/constants/geo"

// PROFILE-005 (بازنویسی): تغییر استان و شهر در «یک» رویداد اعلان می‌شود تا
// والد نتواند با state کهنه، مقدار جدید استان را بازنویسی کند (باگ قبلی:
// onCityChange("") بعد از onProvinceChange(v) استان تازه‌انتخاب‌شده را می‌پوشاند).
export function ProvinceCitySelect({
  province,
  city,
  onChange,
  required,
  disabled,
}: {
  province?: string | null
  city?: string | null
  onChange: (next: { province: string; city: string }) => void
  required?: boolean
  disabled?: boolean
}) {
  const cities = PROVINCES[province ?? ""] ?? []
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          استان {required ? <span className="text-destructive">*</span> : null}
        </label>
        <Select
          value={province ?? ""}
          onValueChange={(v) => onChange({ province: v, city: "" })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="انتخاب استان" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {PROVINCE_NAMES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          شهر {required ? <span className="text-destructive">*</span> : null}
        </label>
        <Select
          value={city ?? ""}
          onValueChange={(c) => onChange({ province: province ?? "", city: c })}
          disabled={!province || disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={province ? "انتخاب شهر" : "ابتدا استان"} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
