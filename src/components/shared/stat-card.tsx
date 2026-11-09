import { cn } from "@/lib/utils"

const TONES: Record<string, { bar: string; icon: string }> = {
  emerald: { bar: "bg-[#3e7c5b]", icon: "bg-[#3e7c5b]/10 text-[#2e5f45]" },
  amber: { bar: "bg-gold", icon: "bg-gold/15 text-gold-deep" },
  sky: { bar: "bg-primary", icon: "bg-secondary text-secondary-foreground" },
  rose: { bar: "bg-destructive", icon: "bg-destructive/10 text-destructive" },
  violet: { bar: "bg-[#7c6bb8]", icon: "bg-[#7c6bb8]/12 text-[#5a4e8c]" },
  slate: { bar: "bg-[#6b7a99]", icon: "bg-muted text-muted-foreground" },
}

export function StatCard({ title, value, hint, icon, tone = "emerald" }: {
  title: string
  value: React.ReactNode
  hint?: string
  icon?: React.ReactNode
  tone?: "emerald" | "amber" | "sky" | "rose" | "violet" | "slate"
}) {
  const t = TONES[tone] ?? TONES.emerald
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 pt-5">
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", t.bar)} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{title}</span>
        {icon ? <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", t.icon)}>{icon}</span> : null}
      </div>
      <div className="font-display mt-2.5 text-2xl font-extrabold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{hint}</div> : null}
    </div>
  )
}
