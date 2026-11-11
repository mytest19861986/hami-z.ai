"use client"

// دکمهٔ چاپ + چاپ خودکار پس از بارگذاری (برای «ذخیره به‌صورت PDF» در مرورگر)
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Printer, CheckCircle2 } from "lucide-react"

export function PrintTrigger() {
  const [printed, setPrinted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print()
        setPrinted(true)
      } catch {
        /* مرورگر چاپ را مسدود کرده — دکمهٔ دستی موجود است */
      }
    }, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-3 py-5">
      <Button onClick={() => window.print()}>
        <Printer className="ml-1 h-4 w-4" />
        چاپ / ذخیره به‌صورت PDF
      </Button>
      {printed ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          پنجرهٔ چاپ باز شد — برای PDF مقصد «Save as PDF» را انتخاب کنید.
        </span>
      ) : null}
    </div>
  )
}
