import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Clock3, ShieldCheck } from "lucide-react"
import { formatToman } from "@/lib/format"
import { toFaDigits } from "@/lib/jalali"
import { cn } from "@/lib/utils"

export interface PlanCardData {
  id: string
  title: string
  description: string | null
  price: number
  durationDays: number
  discountPercent: number
  usageLimit: number | null
  features: string[]
  featured?: boolean
}

export function PlanCard({ plan, featured = false }: { plan: PlanCardData; featured?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-lg bg-card p-6 pt-7",
        featured ? "border-2 border-gold/70 shadow-lg shadow-gold/10" : "border border-border transition-shadow hover:shadow-md"
      )}
    >
      {featured ? (
        <span className="absolute -top-3 right-5 rounded-md bg-gold px-3 py-1 text-[11px] font-bold text-sidebar">پیشنهاد ما</span>
      ) : null}
      <span className={cn("absolute inset-x-0 top-0 h-1 rounded-t-lg", featured ? "bg-gold" : "bg-primary/25")} />
      <h3 className="font-display text-lg font-bold">{plan.title}</h3>
      <p className="mt-1.5 min-h-10 text-sm leading-6 text-muted-foreground">{plan.description}</p>
      <div className="font-display mt-5 text-3xl font-extrabold tabular-nums text-primary">{formatToman(plan.price)}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        اعتبار {toFaDigits(plan.durationDays)} روز ·{" "}
        {plan.usageLimit === null ? "استفاده نامحدود" : `${toFaDigits(plan.usageLimit)} مرتبه استفاده`}
      </div>
      <ul className="mt-5 flex-1 space-y-2.5 border-t border-border/70 pt-5 text-sm">
        <li className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4 shrink-0 text-gold-deep" />
          {toFaDigits(plan.discountPercent)}٪ تخفیف ویزیت پزشکان
        </li>
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-muted-foreground">
            <span className="h-1 w-1 shrink-0 rounded-full bg-gold" />
            {f}
          </li>
        ))}
      </ul>
      <Button asChild className={cn("mt-6 w-full", featured && "h-11")} variant={featured ? "default" : "outline"}>
        <Link href={`/plans/${plan.id}`}>جزئیات و خرید</Link>
      </Button>
    </div>
  )
}
