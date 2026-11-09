import { cn } from "@/lib/utils"

export function StatCard({ title, value, hint, icon, tone = "emerald" }: {
  title: string
  value: React.ReactNode
  hint?: string
  icon?: React.ReactNode
  tone?: "emerald" | "amber" | "sky" | "rose" | "violet" | "slate"
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-700",
  }
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon ? <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])}>{icon}</span> : null}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}
