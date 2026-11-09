"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROVINCES, PROVINCE_NAMES } from "@/constants/geo"

export function ProvinceCitySelect({
  province,
  city,
  onProvinceChange,
  onCityChange,
  required,
}: {
  province?: string | null
  city?: string | null
  onProvinceChange: (p: string) => void
  onCityChange: (c: string) => void
  required?: boolean
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
          onValueChange={(v) => {
            onProvinceChange(v)
            onCityChange("") // PROFILE-005: تغییر استان → بازبینی شهر
          }}
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
        <Select value={city ?? ""} onValueChange={onCityChange} disabled={!province}>
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
