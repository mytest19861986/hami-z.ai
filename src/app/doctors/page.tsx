"use client"

import { useEffect, useState } from "react"
import { PublicHeader, PublicFooter } from "@/components/shared/public-chrome"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Pagination } from "@/components/shared/pagination"
import { api, errMessage } from "@/lib/client"
import { MapPin, Search, Phone } from "lucide-react"
import { PROVINCES } from "@/constants/geo"

const CITY_LISTS = PROVINCES

interface DoctorItem {
  id: string
  name: string
  specialty: string
  clinicName: string | null
  province: string | null
  city: string | null
  clinicPhone: string | null
  bio: string | null
  discountPercent: number | null
}

interface DoctorsResponse {
  total: number
  page: number
  totalPages: number
  doctors: DoctorItem[]
  meta: { specialties: string[]; provinces: string[] }
}

export default function DoctorsPage() {
  const [data, setData] = useState<DoctorsResponse | null>(null)
  const [error, setError] = useState("")
  const [q, setQ] = useState("")
  const [specialty, setSpecialty] = useState("")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")

  const requestKey = JSON.stringify([q, specialty, province, city, page])
  const loading = requestKey !== loadedKey

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (specialty) params.set("specialty", specialty)
    if (province) params.set("province", province)
    if (city) params.set("city", city)
    params.set("page", String(page))
    api
      .get<DoctorsResponse>(`/api/v1/public/doctors?${params.toString()}`)
      .then((d) => {
        if (!mounted) return
        setData(d)
        setError("")
        setLoadedKey(requestKey)
      })
      .catch((e) => {
        if (!mounted) return
        setError(errMessage(e))
        setLoadedKey(requestKey)
      })
    return () => {
      mounted = false
    }
  }, [requestKey])

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">پزشکان طرف قرارداد</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          جست‌وجو بر اساس نام، تخصص و موقعیت استان/شهر — فقط پزشکان تأییدشده نمایش داده می‌شوند.
        </p>

        {/* فیلترها (DOC-002/003) */}
        <div className="mt-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="نام پزشک یا مطب…"
              value={q}
              onChange={(e) => {
                setPage(1)
                setQ(e.target.value)
              }}
              className="pr-9"
            />
          </div>
          <Select
            value={specialty || "ALL"}
            onValueChange={(v) => {
              setPage(1)
              setSpecialty(v === "ALL" ? "" : v)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="همه تخصص‌ها" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="ALL">همه تخصص‌ها</SelectItem>
              {(data?.meta.specialties ?? []).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={province || "ALL"}
            onValueChange={(v) => {
              setPage(1)
              setProvince(v === "ALL" ? "" : v)
              setCity("")
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="همه استان‌ها" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="ALL">همه استان‌ها</SelectItem>
              {(data?.meta.provinces ?? []).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={city || "ALL"}
            onValueChange={(v) => {
              setPage(1)
              setCity(v === "ALL" ? "" : v)
            }}
            disabled={!province}
          >
            <SelectTrigger>
              <SelectValue placeholder={province ? "همه شهرها" : "ابتدا استان"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="ALL">همه شهرها</SelectItem>
              {(CITY_LISTS[province] ?? []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? <p className="mt-6 text-center text-sm text-destructive">{error}</p> : null}

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : data && data.doctors.length === 0 ? (
            <EmptyState
              title="پزشکی یافت نشد"
              description="فیلترها را تغییر دهید یا عبارت دیگری جست‌وجو کنید."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("")
                    setSpecialty("")
                    setProvince("")
                    setCity("")
                    setPage(1)
                  }}
                >
                  حذف فیلترها
                </Button>
              }
            />
          ) : data ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">{data.total} پزشک یافت شد</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.doctors.map((d) => (
                  <Card key={d.id} className="h-full">
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">دکتر {d.name}</h3>
                          <div className="mt-0.5 text-sm text-primary">{d.specialty}</div>
                        </div>
                        {d.discountPercent ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {d.discountPercent}٪ تخفیف
                          </span>
                        ) : null}
                      </div>
                      {d.clinicName ? <div className="mt-2 text-sm">{d.clinicName}</div> : null}
                      <div className="mt-2 flex flex-1 flex-col justify-between">
                        <div className="space-y-1.5 text-sm text-muted-foreground">
                          {d.province ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-4 w-4" />
                              {d.province} / {d.city}
                            </div>
                          ) : null}
                          {d.clinicPhone ? (
                            <div className="flex items-center gap-1.5" dir="ltr">
                              <Phone className="h-4 w-4" />
                              <span dir="rtl">{d.clinicPhone}</span>
                            </div>
                          ) : null}
                          {d.bio ? <p className="line-clamp-2 text-xs leading-5">{d.bio}</p> : null}
                        </div>
                        <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                          <a href={`/auth/login?next=/user/buy`}>استفاده از طرح</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
