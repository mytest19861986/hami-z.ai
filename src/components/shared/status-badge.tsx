"use client"

import { cn } from "@/lib/utils"
import { label } from "@/constants/labels"

const TONES: Record<string, string> = {
  ACTIVE: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
  APPROVED: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
  SUCCESS: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
  COMPLETED: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
  PUBLISHED: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
  FINALIZED: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
  DELIVERED: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
  PAID: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
  PENDING: "bg-gold/12 text-gold-deep border-gold/35",
  PENDING_REVIEW: "bg-gold/12 text-gold-deep border-gold/35",
  UNDER_REVIEW: "bg-gold/12 text-gold-deep border-gold/35",
  REVIEW_PENDING: "bg-gold/12 text-gold-deep border-gold/35",
  CARD_ISSUED: "bg-secondary text-secondary-foreground border-primary/20",
  SENT: "bg-secondary text-secondary-foreground border-primary/20",
  PAYMENT_REGISTERED: "bg-secondary text-secondary-foreground border-primary/20",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/25",
  FAILED: "bg-destructive/10 text-destructive border-destructive/25",
  BLOCKED: "bg-destructive/10 text-destructive border-destructive/25",
  SUSPENDED: "bg-destructive/10 text-destructive border-destructive/25",
  RETURNED: "bg-destructive/10 text-destructive border-destructive/25",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/25",
  EXPIRED: "bg-muted text-muted-foreground border-border",
  DELETED: "bg-muted text-muted-foreground border-border",
  DRAFT: "bg-muted text-muted-foreground border-border",
}

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[status] ?? "bg-muted text-muted-foreground border-border", className)}>
      {label(status)}
    </span>
  )
}

export function TypeBadge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "emerald" | "amber" | "sky" | "rose" | "violet" }) {
  const tones: Record<string, string> = {
    slate: "bg-muted text-muted-foreground border-border",
    emerald: "bg-[#3e7c5b]/10 text-[#2e5f45] border-[#3e7c5b]/25",
    amber: "bg-gold/12 text-gold-deep border-gold/35",
    sky: "bg-secondary text-secondary-foreground border-primary/20",
    rose: "bg-destructive/10 text-destructive border-destructive/25",
    violet: "bg-[#7c6bb8]/12 text-[#5a4e8c] border-[#7c6bb8]/30",
  }
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone])}>{children}</span>
}
