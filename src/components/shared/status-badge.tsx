"use client"

import { cn } from "@/lib/utils"
import { label } from "@/constants/labels"

const TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  SUCCESS: "bg-emerald-100 text-emerald-800 border-emerald-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PUBLISHED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FINALIZED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  REVIEW_PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CARD_ISSUED: "bg-sky-100 text-sky-800 border-sky-200",
  SENT: "bg-sky-100 text-sky-800 border-sky-200",
  PAYMENT_REGISTERED: "bg-sky-100 text-sky-800 border-sky-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
  FAILED: "bg-rose-100 text-rose-800 border-rose-200",
  BLOCKED: "bg-rose-100 text-rose-800 border-rose-200",
  SUSPENDED: "bg-rose-100 text-rose-800 border-rose-200",
  RETURNED: "bg-rose-100 text-rose-800 border-rose-200",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
  EXPIRED: "bg-slate-100 text-slate-700 border-slate-200",
  DELETED: "bg-slate-100 text-slate-700 border-slate-200",
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
}

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[status] ?? "bg-slate-100 text-slate-700 border-slate-200", className)}>
      {label(status)}
    </span>
  )
}

export function TypeBadge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "emerald" | "amber" | "sky" | "rose" | "violet" }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    sky: "bg-sky-100 text-sky-800 border-sky-200",
    rose: "bg-rose-100 text-rose-800 border-rose-200",
    violet: "bg-violet-100 text-violet-800 border-violet-200",
  }
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone])}>{children}</span>
}
