"use client"

import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft } from "lucide-react"

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronRight className="h-4 w-4" />
        قبلی
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        صفحه {page} از {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        بعدی
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  )
}
